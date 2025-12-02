// FILE: src/composables/useSubscriptions.js
import { ref, computed, watch } from 'vue';
import { fetchNodeCount, batchUpdateNodes } from '../lib/api.js';
import { useToastStore } from '../stores/toast.js';

const HTTP_REGEX = /^https?:\/\//;

// 【修改】新增第三个参数 triggerAutoSave
export function useSubscriptions(initialSubsRef, markDirty, triggerAutoSave) {
  const { showToast } = useToastStore();
  const subscriptions = ref([]);
  const subsCurrentPage = ref(1);
  const subsItemsPerPage = 6;

  // 辅助函数：执行保存并刷新
  const tryAutoSave = async (msg) => {
    if (typeof triggerAutoSave === 'function') {
        if(msg) showToast(msg, 'success');
        await triggerAutoSave();
    } else {
        if (markDirty) markDirty();
    }
  };

  function initializeSubscriptions(subsData) {
    subscriptions.value = (subsData || []).map(sub => ({
      ...sub,
      id: sub.id || crypto.randomUUID(),
      enabled: sub.enabled ?? true,
      nodeCount: sub.nodeCount || 0,
      isUpdating: false,
      userInfo: sub.userInfo || null,
      exclude: sub.exclude || '',
    }));
  }

  const totalSubscriptionCount = computed(() => subscriptions.value.length);

  const enabledSubscriptions = computed(() => subscriptions.value.filter(s => s.enabled));
  
  const subsTotalPages = computed(() => Math.ceil(subscriptions.value.length / subsItemsPerPage));
  const paginatedSubscriptions = computed(() => {
    const start = (subsCurrentPage.value - 1) * subsItemsPerPage;
    const end = start + subsItemsPerPage;
    return subscriptions.value.slice(start, end);
  });

  function changeSubsPage(page) {
    if (page < 1 || page > subsTotalPages.value) return;
    subsCurrentPage.value = page;
  }

  async function handleUpdateNodeCount(subId, isInitialLoad = false) {
    const subToUpdate = subscriptions.value.find(s => s.id === subId);
    if (!subToUpdate || !HTTP_REGEX.test(subToUpdate.url)) return;
    
    if (!isInitialLoad) {
        subToUpdate.isUpdating = true;
    }

    try {
      const data = await fetchNodeCount(subToUpdate.url);
      subToUpdate.nodeCount = data.count || 0;
      subToUpdate.userInfo = data.userInfo || null;
      
      if (!isInitialLoad) {
        showToast(`${subToUpdate.name || '订阅'} 已更新`, 'success');
        // 更新订阅信息通常也需要保存
        tryAutoSave(); 
      }
    } catch (error) {
      if (!isInitialLoad) showToast(`${subToUpdate.name || '订阅'} 更新失败`, 'error');
      console.error(`Failed to fetch node count for ${subToUpdate.name}:`, error);
    } finally {
      subToUpdate.isUpdating = false;
    }
  }

  function addSubscription(sub) {
    subscriptions.value.unshift(sub);
    
    const currentPageItems = paginatedSubscriptions.value.length;
    if (currentPageItems >= subsItemsPerPage) {
      subsCurrentPage.value = 1;
    }
    
    handleUpdateNodeCount(sub.id); 

    tryAutoSave('订阅已添加，正在保存...'); // 【修改】
  }

  function updateSubscription(updatedSub) {
    const index = subscriptions.value.findIndex(s => s.id === updatedSub.id);
    if (index !== -1) {
      if (subscriptions.value[index].url !== updatedSub.url) {
        updatedSub.nodeCount = 0;
        handleUpdateNodeCount(updatedSub.id); 
      }
      subscriptions.value[index] = updatedSub;
      if (markDirty) markDirty(); // 修改属性暂时不强制刷新，避免输入一半就刷新
    }
  }

  function deleteSubscription(subId) {
    const index = subscriptions.value.findIndex(s => s.id === subId);
    if (index !== -1) {
      subscriptions.value.splice(index, 1);
      tryAutoSave('订阅已删除，正在保存并刷新...'); // 【修改】
    }

    if (paginatedSubscriptions.value.length === 0 && subsCurrentPage.value > 1) {
      subsCurrentPage.value--;
    }
  }

  function deleteAllSubscriptions() {
    subscriptions.value.splice(0, subscriptions.value.length);
    subsCurrentPage.value = 1;
    tryAutoSave('所有订阅已清空，正在刷新...'); // 【修改】
  }
  
  async function addSubscriptionsFromBulk(subs) {
    subscriptions.value.unshift(...subs);
    subsCurrentPage.value = 1;
    
    tryAutoSave('批量添加成功，正在保存...'); // 【修改】先保存结构

    const subsToUpdate = subs.filter(sub => sub.url && HTTP_REGEX.test(sub.url));
    // ... (后续更新逻辑保持不变)
  }

  watch(initialSubsRef, (newInitialSubs) => {
    initializeSubscriptions(newInitialSubs);
  }, { immediate: true, deep: true });

  return {
    subscriptions,
    subsCurrentPage,
    subsTotalPages,
    paginatedSubscriptions,
    enabledSubscriptionsCount: computed(() => enabledSubscriptions.value.length),
    totalSubscriptionCount,
    changeSubsPage,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    deleteAllSubscriptions,
    addSubscriptionsFromBulk,
    handleUpdateNodeCount,
  };
}
