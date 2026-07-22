/* Supports the styles client workflow with reusable logic kept close to the screens that consume it. */
import { createTheme } from '@mui/material/styles';

export const procurexTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#008080',
      dark: '#006d6d',
      light: '#40c9c9'
    },
    secondary: {
      main: '#1769b2'
    },
    success: {
      main: '#16834a'
    },
    warning: {
      main: '#b7791f'
    },
    error: {
      main: '#b91c1c'
    },
    text: {
      primary: '#17212f',
      secondary: '#5b6675'
    },
    background: {
      default: '#f7fafc',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    button: {
      textTransform: 'none',
      fontWeight: 700
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          minHeight: 42,
          boxShadow: 'none'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          border: '1px solid rgba(23, 33, 47, 0.08)',
          boxShadow: 'none'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        size: 'small'
      }
    },
    MuiSelect: {
      defaultProps: {
        size: 'small'
      }
    }
  }
});
