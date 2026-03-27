// Email Validation
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Phone Validation (Nigerian)
export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Nigerian phone: 11 digits starting with 0 or 13 digits starting with 234
  return (
    (cleaned.length === 11 && cleaned.startsWith('0')) ||
    (cleaned.length === 13 && cleaned.startsWith('234'))
  );
};

// Password Validation - Simple (allow any password with min length)
export const isValidPassword = (password: string): { valid: boolean; message: string } => {
  if (password.length < 4) {
    return { valid: false, message: 'Password must be at least 4 characters' };
  }
  return { valid: true, message: '' };
};

// Simple Password Validation (for login)
export const isPasswordNotEmpty = (password: string): boolean => {
  return password.length >= 1;
};

// Name Validation
export const isValidName = (name: string): boolean => {
  return name.trim().length >= 2;
};

// URL Validation
export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

// Required Field
export const isRequired = (value: string): boolean => {
  return value.trim().length > 0;
};

// Form Validation Helper
export interface ValidationRule {
  validator: (value: string) => boolean;
  message: string;
}

export const validateField = (value: string, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    if (!rule.validator(value)) {
      return rule.message;
    }
  }
  return null;
};

// Login Form Validation
export const validateLoginForm = (email: string, password: string): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!isRequired(email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email';
  }

  if (!isRequired(password)) {
    errors.password = 'Password is required';
  }

  return errors;
};

// Register Form Validation
export const validateRegisterForm = (
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
  phone?: string
): Record<string, string> => {
  const errors: Record<string, string> = {};

  if (!isRequired(name)) {
    errors.name = 'Name is required';
  } else if (!isValidName(name)) {
    errors.name = 'Name must be at least 2 characters';
  }

  if (!isRequired(email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(email)) {
    errors.email = 'Please enter a valid email';
  }

  // Phone is required
  if (!phone || !isRequired(phone)) {
    errors.phone = 'Phone number is required';
  } else if (!isValidPhone(phone)) {
    errors.phone = 'Please enter a valid Nigerian phone number';
  }

  if (!isRequired(password)) {
    errors.password = 'Password is required';
  } else {
    const passwordValidation = isValidPassword(password);
    if (!passwordValidation.valid) {
      errors.password = passwordValidation.message;
    }
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return errors;
};
