<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenDrawer } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { updateDeployEnvironmentEnvVars } from '#/api/project-management/deploy-environment';
import { $t } from '#/locales';

const emits = defineEmits(['success']);

interface EnvRow {
  key: string;
  value: string;
  id: number;
}

let rowIdCounter = 0;
const environmentId = ref('');
const environmentName = ref('');
const rows = ref<EnvRow[]>([]);
const loading = ref(false);

const [Drawer, drawerApi] = useVbenDrawer({
  onOpenChange(isOpen) {
    if (isOpen) {
      const data = drawerApi.getData<{
        id: string;
        name: string;
        envVars?: Record<string, string>;
      }>();
      environmentId.value = data?.id ?? '';
      environmentName.value = data?.name ?? '';

      const map = data?.envVars ?? {};
      const entries = Object.entries(map).map(([key, value]) => ({
        key,
        value,
        id: rowIdCounter++,
      }));
      rows.value = entries.length > 0 ? entries : [{ key: '', value: '', id: rowIdCounter++ }];
    }
  },
});

const title = computed(
  () => `${$t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.title')} — ${environmentName.value}`,
);

const duplicateKeys = computed(() => {
  const seen = new Set<string>();
  const dups = new Set<string>();
  for (const row of rows.value) {
    const k = row.key.trim();
    if (!k) continue;
    if (seen.has(k)) dups.add(k);
    seen.add(k);
  }
  return dups;
});

function addRow() {
  rows.value.push({ key: '', value: '', id: rowIdCounter++ });
}

function removeRow(id: number) {
  rows.value = rows.value.filter((r) => r.id !== id);
}

function validate(): boolean {
  for (const row of rows.value) {
    if (!row.key.trim()) {
      message.error(
        $t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.keyRequired'),
      );
      return false;
    }
  }
  if (duplicateKeys.value.size > 0) {
    message.error(
      $t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.keyDuplicate'),
    );
    return false;
  }
  return true;
}

async function handleConfirm() {
  if (!validate()) return;

  const envVars: Record<string, string> = {};
  for (const row of rows.value) {
    const k = row.key.trim();
    if (k) envVars[k] = row.value;
  }

  loading.value = true;
  try {
    await updateDeployEnvironmentEnvVars(environmentId.value, envVars);
    message.success(
      $t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.saveSuccess'),
    );
    emits('success');
    drawerApi.close();
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Drawer :title="title">
    <div class="env-vars-list">
      <!-- 表头 -->
      <div class="env-vars-header">
        <span class="col-key">{{
          $t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.keyLabel')
        }}</span>
        <span class="col-value">{{
          $t('deploy.packageDeployManagement.environmentConfig.envVarsDrawer.valueLabel')
        }}</span>
        <span class="col-action" />
      </div>

      <!-- 行 -->
      <div v-for="row in rows" :key="row.id" class="env-vars-row">
        <Input
          v-model:value="row.key"
          class="col-key"
          :placeholder="
            $t(
              'deploy.packageDeployManagement.environmentConfig.envVarsDrawer.keyPlaceholder',
            )
          "
          :status="duplicateKeys.has(row.key.trim()) && row.key.trim() ? 'error' : undefined"
          spellcheck="false"
        />
        <Input
          v-model:value="row.value"
          class="col-value"
          :placeholder="
            $t(
              'deploy.packageDeployManagement.environmentConfig.envVarsDrawer.valuePlaceholder',
            )
          "
          spellcheck="false"
        />
        <div class="col-action">
          <Button type="text" danger @click="removeRow(row.id)">×</Button>
        </div>
      </div>

      <!-- 添加行 -->
      <Button class="mt-3" type="dashed" block @click="addRow">
        +
        {{
          $t(
            'deploy.packageDeployManagement.environmentConfig.envVarsDrawer.addRow',
          )
        }}
      </Button>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button @click="drawerApi.close()">{{ $t('common.cancel') }}</Button>
        <Button type="primary" :loading="loading" @click="handleConfirm">
          {{ $t('common.confirm') }}
        </Button>
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.env-vars-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.env-vars-header {
  display: flex;
  gap: 8px;
  padding: 0 2px;
  font-size: 12px;
  color: var(--ant-color-text-secondary, #666);
  font-weight: 500;
}

.env-vars-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.col-key {
  flex: 2;
  min-width: 0;
}

.col-value {
  flex: 3;
  min-width: 0;
}

.col-action {
  flex: none;
  width: 32px;
  display: flex;
  justify-content: center;
}
</style>
