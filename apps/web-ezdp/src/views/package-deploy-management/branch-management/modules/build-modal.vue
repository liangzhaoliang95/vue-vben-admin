<script lang="ts" setup>
import type { BranchManagementApi } from '#/api/package-deploy-management/branch-management';

import { computed } from 'vue';

import { Modal } from 'ant-design-vue';

import { $t } from '#/locales';

import ProjectPackageList from '../../project-package/list.vue';

interface Props {
  open: boolean;
  branch: BranchManagementApi.BranchManagement | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:open': [value: boolean];
}>();

const modalTitle = computed(() => {
  if (!props.branch) return '';
  return $t('deploy.packageDeployManagement.branchManagement.buildModal.title', {
    name: props.branch.name,
  });
});

function handleClose() {
  emit('update:open', false);
}
</script>

<template>
  <Modal
    :open="open"
    :title="modalTitle"
    :footer="null"
    width="1100px"
    :body-style="{ padding: '0', maxHeight: '80vh', overflowY: 'auto' }"
    destroy-on-close
    @cancel="handleClose"
  >
    <ProjectPackageList v-if="open && branch" :initial-branch-id="branch.id" :initial-branch-name="branch.name" :initial-business-line-id="branch.businessLineId" />
  </Modal>
</template>
