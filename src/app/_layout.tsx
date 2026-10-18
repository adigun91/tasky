import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { Ionicons } from '@expo/vector-icons';
import { TasksProvider, useTasks } from '@/context/TasksContext';
import { ProfileProvider, useProfile } from '@/context/ProfileContext';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { Footer } from '@/components/Footer';

// Keep the native splash screen up until tasks/profile finish loading from storage.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

function useAlarmNotificationObserver() {
  useEffect(() => {
    // expo-notifications' listener/response APIs aren't implemented on web.
    if (Platform.OS === 'web') return;

    function handle(notification: Notifications.Notification) {
      const data = notification.request.content.data as
        | { taskId?: string; alarmEnabled?: boolean }
        | undefined;
      if (!data?.taskId) return;
      if (data.alarmEnabled) {
        router.push({ pathname: '/alarm', params: { taskId: data.taskId } });
      }
    }

    // App was in the foreground when the alarm fired.
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      handle(notification);
    });

    // User tapped a notification (app was backgrounded or killed).
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      handle(response.notification);
    });

    const last = Notifications.getLastNotificationResponse();
    if (last) handle(last.notification);

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);
}

// Redirects to /sign-in when cloud sync is configured but no one is signed in, and back when signed in.
function useAuthGate() {
  const { cloudEnabled, session, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (!cloudEnabled || loading) return;
    const inAuthScreen = segments[0] === 'sign-in';
    if (!session && !inAuthScreen) {
      router.replace('/sign-in');
    } else if (session && inAuthScreen) {
      router.replace('/');
    }
  }, [cloudEnabled, session, loading, segments]);
}

function RootLayoutNav() {
  useAlarmNotificationObserver();
  useAuthGate();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#fff' },
        headerTitleStyle: { fontWeight: '700', color: '#111827' },
        headerTintColor: '#4F46E5',
        contentStyle: { backgroundColor: '#F9FAFB' },
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      <Stack.Screen name="task-form" options={{ title: 'Task', presentation: 'modal' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="alarm" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="profile" options={{ title: 'Profile', presentation: 'modal' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings', presentation: 'modal' }} />
    </Stack>
  );
}

// Mirrors the native splash (same icon/background) with the Footer added, shown during its fade-out.
function SplashVisual() {
  return (
    <View style={splashStyles.container}>
      <Ionicons name="checkmark-done-circle" size={96} color="#fff" />
      <Footer light />
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Renders a splash-matching visual until tasks/profile/auth are loaded, so the native splash's
// fade-out reveals this instead of a blank screen.
function SplashGate() {
  const { loading: tasksLoading } = useTasks();
  const { loading: profileLoading } = useProfile();
  const { loading: authLoading } = useAuth();
  const ready = !tasksLoading && !profileLoading && !authLoading;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return <SplashVisual />;
  return (
    <>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ProfileProvider>
          <TasksProvider>
            <SplashGate />
          </TasksProvider>
        </ProfileProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
