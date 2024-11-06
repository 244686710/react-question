export interface ErrorHandler {
  showError(message: string): void;
}

export const defaultErrorHandler: ErrorHandler = {
  showError(message: string) {
    alert(message); // TODO: alert 可以替换成错误提示组件
  }
};
