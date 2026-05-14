import { requestClient } from '#/api/request';

/**
 * 系统配置
 */
export namespace SystemConfig {
	/**
	 * 系统配置数据
	 */
	export interface ConfigData {
		platformDomain: string; // 平台域名，如 https://simple.plaso.cn
		apiPrefix: string; // API 前缀，如 /server/ezdp
		serverAgentAddr?: string; // Server Agent TCP 连接地址，如 your-server.com:82
		appVersion?: string; // 应用版本号
	}

	/**
	 * 获取系统配置
	 */
	export async function getConfig() {
		return requestClient.post<ConfigData>('/nc/system/getConfig', {});
	}
}
