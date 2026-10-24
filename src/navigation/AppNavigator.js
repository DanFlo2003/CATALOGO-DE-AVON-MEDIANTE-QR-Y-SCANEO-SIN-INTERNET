import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Text } from 'react-native';
import InicioScreen from '../screens/InicioScreen';
import EscanerScreen from '../screens/EscanerScreen';
import SeccionesScreen from '../screens/SeccionesScreen';
import HistorialScreen from '../screens/HistorialScreen';
import AjustesScreen from '../screens/AjustesScreen';
import { colors } from '../utils/colors';

const Tab = createBottomTabNavigator();

const icons = {
  Inicio: '🏠',
  Escáner: '📷',
  Secciones: '🗂️',
  Historial: '🧾',
  Ajustes: '⚙️',
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarStyle: { backgroundColor: '#fff', borderTopColor: '#f0dece', height: 64, paddingBottom: 8, paddingTop: 6 },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.subtext,
          tabBarLabelStyle: { fontWeight: '800' },
          tabBarIcon: () => <Text style={{ fontSize: 18 }}>{icons[route.name] || '•'}</Text>,
        })}
      >
        <Tab.Screen name="Inicio" component={InicioScreen} />
        <Tab.Screen name="Escáner" component={EscanerScreen} />
        <Tab.Screen name="Secciones" component={SeccionesScreen} />
        <Tab.Screen name="Historial" component={HistorialScreen} />
        <Tab.Screen name="Ajustes" component={AjustesScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
