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
	}

	/**
	 * 获取系统配置
	 */
	export async function getConfig() {
		return requestClient.post<ConfigData>('/nc/system/getConfig', {});
	}
}
