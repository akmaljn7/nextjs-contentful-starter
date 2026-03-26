// Price Formatter (Nigerian Naira)
export const formatPrice = (amount: number): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Number Formatter (with K, M suffixes)
export const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
};

// Date Formatter
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

// Time Formatter
export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// DateTime Formatter
export const formatDateTime = (dateString: string): string => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

// Relative Time (e.g., "2 hours ago")
export const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'Just now';
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return formatDate(dateString);
};

// Phone Number Formatter
export const formatPhoneNumber = (phone: string): string => {
  // Nigerian phone format
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11 && cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  if (cleaned.length === 13 && cleaned.startsWith('234')) {
    return `+${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  return phone;
};

// Status Badge Colors
export const getStatusColor = (status: string): { bg: string; text: string } => {
  const statusColors: Record<string, { bg: string; text: string }> = {
    // Order statuses
    pending: { bg: '#fef3c7', text: '#b45309' },
    accepted: { bg: '#dbeafe', text: '#1d4ed8' },
    in_progress: { bg: '#ede9fe', text: '#7c3aed' },
    proof_submitted: { bg: '#e0e7ff', text: '#4338ca' },
    completed: { bg: '#d1fae5', text: '#047857' },
    cancelled: { bg: '#fee2e2', text: '#b91c1c' },
    disputed: { bg: '#fef2f2', text: '#dc2626' },
    confirmed: { bg: '#dbeafe', text: '#1d4ed8' },
    // Payment statuses
    paid: { bg: '#d1fae5', text: '#047857' },
    pending_cash: { bg: '#fef3c7', text: '#b45309' },
    held: { bg: '#e0e7ff', text: '#4338ca' },
    released: { bg: '#d1fae5', text: '#047857' },
    failed: { bg: '#fee2e2', text: '#b91c1c' },
    refunded: { bg: '#f3f4f6', text: '#4b5563' },
    // Consultation statuses
    scheduled: { bg: '#dbeafe', text: '#1d4ed8' },
    // Misc
    active: { bg: '#d1fae5', text: '#047857' },
    approved: { bg: '#d1fae5', text: '#047857' },
    rejected: { bg: '#fee2e2', text: '#b91c1c' },
  };

  return statusColors[status] || { bg: '#f3f4f6', text: '#4b5563' };
};

// Status Label
export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    // Order statuses
    pending: 'Pending',
    accepted: 'Accepted',
    in_progress: 'In Progress',
    proof_submitted: 'Proof Submitted',
    completed: 'Completed',
    cancelled: 'Cancelled',
    disputed: 'Disputed',
    confirmed: 'Confirmed',
    // Payment statuses
    paid: 'Paid',
    pending_cash: 'Pay at Office',
    held: 'Held',
    released: 'Released',
    failed: 'Failed',
    refunded: 'Refunded',
    // Consultation statuses
    scheduled: 'Scheduled',
    // Misc
    active: 'Active',
    approved: 'Approved',
    rejected: 'Rejected',
  };

  return labels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

// Truncate Text
export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
};

// Get Initials
export const getInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

// Platform Icon Mapping
export const getPlatformIcon = (platform: string): string => {
  const icons: Record<string, string> = {
    instagram: 'logo-instagram',
    tiktok: 'logo-tiktok',
    twitter: 'logo-twitter',
    facebook: 'logo-facebook',
    youtube: 'logo-youtube',
    whatsapp: 'logo-whatsapp',
    snapchat: 'logo-snapchat',
    google: 'logo-google',
  };

  return icons[platform.toLowerCase()] || 'globe-outline';
};
