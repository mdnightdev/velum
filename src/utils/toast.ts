import toast from 'react-hot-toast';

export const velumToastStyle = {
  style: {
    background: '#101218',
    color: '#F5F2EB',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif'
  },
  duration: 2500 // 2.5 seconds
};

export const velumToast = {
  success: (message: string) => toast.success(message, { ...velumToastStyle, id: `ok:${message}` }),
  error: (message: string) => toast.error(message, { ...velumToastStyle, id: `err:${message}` }),
  info: (message: string) => toast(message, { ...velumToastStyle, id: `info:${message}` }),
  loading: (message: string) => toast.loading(message, { ...velumToastStyle, id: `load:${message}` }),
  dismiss: () => toast.dismiss()
};

export default velumToast;