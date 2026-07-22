/* Renders the shared Form Controls UI while keeping page-specific presentation near its workflow data. */
import { TextField, type TextFieldProps } from '@mui/material';

export function FormField(props: TextFieldProps) {
  return <TextField fullWidth {...props} />;
}
