const velumToastStyle = {
  style: {
    background: '#101218',
    color: '#F5F2EB',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    fontSize: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
  duration: 2500,
};

type HotToast = typeof import('react-hot-toast').default;

let toastLoad: Promise<HotToast> | null = null;

function loadToast(): Promise<HotToast | null> {
  if (typeof document === 'undefined') return Promise.resolve(null);
  if (!toastLoad) {
    toastLoad = import('react-hot-toast').then((m) => m.default);
  }
  return toastLoad;
}

export { velumToastStyle };

export const velumToast = {
  success: (message: string) => {
    void loadToast().then((toast) => {
      toast?.success(message, { ...velumToastStyle, id: `ok:${message}` });
    });
  },
  error: (message: string) => {
    void loadToast().then((toast) => {
      toast?.error(message, { ...velumToastStyle, id: `err:${message}` });
    });
  },
  info: (message: string) => {
    void loadToast().then((toast) => {
      toast?.(message, { ...velumToastStyle, id: `info:${message}` });
    });
  },
  loading: (message: string) => {
    void loadToast().then((toast) => {
      toast?.loading(message, { ...velumToastStyle, id: `load:${message}` });
    });
  },
  dismiss: () => {
    void loadToast().then((toast) => {
      toast?.dismiss();
    });
  },
};

export default velumToast;
