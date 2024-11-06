// 获取token
export function getToken(): InternalToken.Token {
  const tokenStr = localStorage.getItem('token');
  return tokenStr ? JSON.parse(tokenStr) : {};
}

// 设置 token
export function setToken(token: InternalToken.Token) {
  return localStorage.setItem('token', JSON.stringify(token));
}

// 删除 token
export function deleteToken(): void {
  localStorage.removeItem('token');
}
