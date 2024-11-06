import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';

import { getToken, setToken, deleteToken } from '@/core/request/token';
import { refreshToken } from '@/api/interface/auth';
import { defaultErrorHandler } from '@/api/interface/toast';

export type Response<T> =
  | {
      data: T;
      success: true;
      errorCode?: string;
      errorMessage?: string;
    }
  | {
      data?: T;
      success: false;
      errorCode: number;
      errorMessage: string;
    };

type ExtractKeys<T extends string> =
  T extends `${string}{${infer Key}}${infer Rest}`
    ? Key | ExtractKeys<Rest>
    : never;

type PathVariables<T extends string> = ExtractKeys<T> extends never
  ? Record<string, string | number>
  : Record<ExtractKeys<T>, string | number>;

type RequestConfig<
  D extends object,
  Q extends object,
  U extends string,
  P = PathVariables<U>
> = Omit<AxiosRequestConfig<D>, 'url' | 'params'> & {
  /**
   * @example '/api/:id' => pathVariables: { id: "1" }
   * @example '/api/:id/:name' => pathVariables: { id: "1", name: "2" }
   */
  url: U;
  ignoreAuth?: boolean; //不為true時 header需附帶Authentication value為token
  silentError?: boolean;
  throwError?: boolean;
  params?: Q;
  /**
   * @example '/api/:id' => { id: "1" }
   * @example '/api/:id/:name' => { id: "1", name: "2" }
   */
  pathVariables?: P;
};

export interface Request {
  <
    T,
    D extends object = any,
    Q extends object = any,
    U extends string = string,
    P = PathVariables<U>
  >(
    args: RequestConfig<D, Q, U, P>
  ): Promise<Response<T>>;
}

/**
 * 替换 URL 中的路径变量
 *
 * @param url - 原始 URL 字符串
 * @param pathVariables - 包含路径变量及其对应值的对象
 * @returns 替换路径变量后的 URL 字符串
 */
function replacePathVariables<T extends string>(
  url: T,
  pathVariables: PathVariables<T>
): T {
  let requestUrl = url;
  for (const key in pathVariables) {
    if (pathVariables.hasOwnProperty(key)) {
      requestUrl = url.replace(
        /:([a-zA-Z0-9_]+)/g,
        String(pathVariables[key])
      ) as T;
    }
  }
  return requestUrl;
}

// 判断token是否过期
function isTokenExpired(token: InternalToken.Token): boolean {
  const now = Date.now();
  return now > token.accessExpiredAt || now > token.refreshExpiredAt;
}

// 判断refreshToken是否过期
function isRefreshTokenExpired(token: InternalToken.Token): boolean {
  const now = Date.now();
  return now > token.refreshExpiredAt;
}
const request: Request = async <
  T = any,
  D extends object = any,
  Q extends object = any,
  U extends string = string,
  P = PathVariables<U>
>(
  args: RequestConfig<D, Q, U, P>
) => {
  const {
    url,
    params,
    pathVariables,
    ignoreAuth,
    silentError,
    throwError,
    ...config
  } = args;
  const token = getToken();
  if (token && !ignoreAuth) {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token.access}`
    };
  }
  // 替换路径中的变量
  let requestUrl = url;
  if (pathVariables) {
    requestUrl = replacePathVariables(url, pathVariables as PathVariables<U>);
  }
  try {
    const response: AxiosResponse<Response<T>> = await axios({
      ...config,
      url: requestUrl,
      params
    });

    if (response.status === 200) {
      // return response.data;
      return {
        data: response.data.data as T,
        success: true
      };
    } else {
      throw new Error(response.data.errorMessage || '请求失败');
    }
  } catch (error: any) {
    // 错误处理，如果token失效尝试刷新token
    if (error.response && error.response.status === 401 && !ignoreAuth) {
      const currentToken = getToken();
      if (currentToken && isTokenExpired(currentToken)) {
        if (isRefreshTokenExpired(currentToken)) {
          // 清除本地token；
          deleteToken();
          // 刷新令牌已过期，无法更新token
          if (!silentError) {
            defaultErrorHandler.showError('刷新令牌已过期，请重新登录');
          }
          if (throwError) {
            throw new Error('刷新令牌已过期');
          }
          return {
            success: false,
            errorCode: 401,
            errorMessage: '刷新令牌已过期'
          } as Response<T>;
        } else {
          try {
            const newToken = await refreshToken({
              refreshToken: currentToken.refresh
            });
            if (newToken && newToken.success) {
              setToken(newToken.data);
              // 重新发起请求
              return request(args);
            }
          } catch (refreshError) {
            // 清除本地token；
            deleteToken();
            if (!silentError) {
              defaultErrorHandler.showError('刷新令牌失败，请重新登录');
            }
            if (throwError) {
              throw refreshError;
            }
            return {
              success: false,
              errorCode: 401,
              errorMessage: '刷新令牌失败'
            } as Response<T>;
          }
        }
      }
    }
    // 请求失败时，弹出错误提示
    if (!silentError) {
      defaultErrorHandler.showError(
        error?.response?.data?.message || '请求失败'
      );
    }
    if (throwError) {
      // 如果需要抛出错误，继续抛出
      throw error;
    }

    return {
      success: false,
      errorCode: error?.code,
      errorMessage: error?.message
    } as Response<T>;
  }
};

export default request;
