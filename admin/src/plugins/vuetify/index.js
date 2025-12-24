import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { zhHans } from 'vuetify/locale'
import { h } from 'vue'
import 'vuetify/styles'
import '@mdi/font/css/materialdesignicons.css'

const myCustomTheme = {
  dark: false,
  colors: {
    background: '#F8FAFC', // Slate 50 - Cooler, more modern background
    surface: '#FFFFFF',
    primary: '#4F46E5', // Indigo 600 - More premium than standard blue
    'primary-darken-1': '#4338CA', // Indigo 700
    secondary: '#8B5CF6', // Violet 500
    'secondary-darken-1': '#7C3AED',
    error: '#EF4444',
    info: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    'on-background': '#0F172A', // Slate 900
    'on-surface': '#1E293B', // Slate 800
  },
}

const myCustomDarkTheme = {
  dark: true,
  colors: {
    background: '#0F172A', // Slate 900
    surface: '#1E293B', // Slate 800
    primary: '#6366F1', // Indigo 500
    'primary-darken-1': '#4F46E5',
    secondary: '#A78BFA',
    'secondary-darken-1': '#8B5CF6',
    error: '#F87171',
    info: '#22D3EE',
    success: '#34D399',
    warning: '#FBBF24',
  },
}

export default createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    sets: {
      mdi: {
        component: (props) => h('i', {
          class: ['mdi', props.icon],
          'aria-hidden': true
        })
      }
    }
  },
  locale: {
    locale: 'zhHans',
    messages: { zhHans },
  },
  theme: {
    defaultTheme: 'myCustomTheme',
    themes: {
      myCustomTheme,
      myCustomDarkTheme,
    },
  },
  defaults: {
    global: {
      ripple: false,
    },
    VCard: {
      rounded: 'xl',
      elevation: 0,
      border: true,
    },
    VBtn: {
      rounded: 'lg',
      height: 40,
      elevation: 0,
      variant: 'flat',
    },
    VTextField: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VSelect: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VTextarea: {
      variant: 'outlined',
      density: 'comfortable',
      color: 'primary',
      hideDetails: 'auto',
    },
    VNavigationDrawer: {
      elevation: 0,
      border: 'e',
      color: 'surface',
    },
    VAppBar: {
      elevation: 0,
      border: 'b',
      color: 'surface',
    },
  },
})