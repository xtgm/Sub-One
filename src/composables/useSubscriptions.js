// FILE: src/composables/useSubscriptions.js
import { ref, computed, watch } from 'vue';
import { fetchNodeCount, batchUpdateNodes } from '../lib/api.js';
import { useToastStore } from '../stores/toast.js';

// 优化：预编译正则表达式，提升性能
const HTTP_REGEX = /^https?:\/\//;

export function useSubscriptions(initialSubsRef, markDirty) {
  const { showToast } = useToastStore();
  const subscriptions = ref([]);
  const subsCurrentPage = ref(1);
  const subsItemsPerPage = 6;

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

  // 【关键修复】新增实时总数计算属性，用于绑定顶部导航数字
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
      }
    } catch (error) {
      if (!isInitialLoad) showToast(`${subToUpdate.name || '订阅'} 更新失败`, 'error');
      console.error(`Failed to fetch node count for ${subToUpdate.name}:`, error);
    } finally {
      subToUpdate.isUpdating = false;
    }
  }

  function addSubscription(sub) {
    // 1. 插入数据，Vue 的 ref 会自动触发 totalSubscriptionCount 更新
    subscriptions.value.unshift(sub);
    
    // 2. 处理分页：如果当前页满了，跳回第一页看到最新的
    const currentPageItems = paginatedSubscriptions.value.length;
    if (currentPageItems >= subsItemsPerPage) {
      subsCurrentPage.value = 1;
    }
    
    // 3. 自动获取节点数
    handleUpdateNodeCount(sub.id); 

    // 4. 标记界面为“有未保存的更改”
    if (markDirty) markDirty();
  }

  function updateSubscription(updatedSub) {
    const index = subscriptions.value.findIndex(s => s.id === updatedSub.id);
    if (index !== -1) {
      if (subscriptions.value[index].url !== updatedSub.url) {
        updatedSub.nodeCount = 0;
        handleUpdateNodeCount(updatedSub.id); 
      }
      subscriptions.value[index] = updatedSub;
      if (markDirty) markDirty();
    }
  }

  function deleteSubscription(subId) {
    const index = subscriptions.value.findIndex(s => s.id === subId);
    if (index !== -1) {
      subscriptions.value.splice(index, 1);
      if (markDirty) markDirty();
    }

    if (paginatedSubscriptions.value.length === 0 && subsCurrentPage.value > 1) {
      subsCurrentPage.value--;
    }
  }

  function deleteAllSubscriptions() {
    subscriptions.value.splice(0, subscriptions.value.length);
    subsCurrentPage.value = 1;
    if (markDirty) markDirty();
  }
  
  async function addSubscriptionsFromBulk(subs) {
    subscriptions.value.unshift(...subs);
    subsCurrentPage.value = 1;
    
    if (markDirty) markDirty();

    const subsToUpdate = subs.filter(sub => sub.url && HTTP_REGEX.test(sub.url));

    if (subsToUpdate.length > 0) {
      showToast(`正在批量更新 ${subsToUpdate.length} 个订阅...`, 'success');
      try {
        const result = await batchUpdateNodes(subsToUpdate.map(sub => sub.id));

        if (result.success) {
          const subsMap = new Map(subscriptions.value.map(s => [s.id, s]));
          result.results.forEach(updateResult => {
            if (updateResult.success) {
              const sub = subsMap.get(updateResult.id);
              if (sub) {
                if (typeof updateResult.nodeCount === 'number') sub.nodeCount = updateResult.nodeCount;
                if (updateResult.userInfo) sub.userInfo = updateResult.userInfo;
              }
            }
          });
          const successCount = result.results.filter(r => r.success).length;
          showToast(`批量更新完成！成功更新 ${successCount}/${subsToUpdate.length} 个订阅`, 'success');
        } else {
          showToast(`批量更新失败: ${result.message}`, 'error');
          showToast('正在降级到逐个更新模式...', 'info');
          for(const sub of subsToUpdate) await handleUpdateNodeCount(sub.id);
        }
      } catch (error) {
        console.error('Batch update failed:', error);
        showToast('批量更新失败，正在降级到逐个更新...', 'error');
        for(const sub of subsToUpdate) await handleUpdateNodeCount(sub.id);
      }
    } else {
      showToast('批量导入完成！', 'success');
    }
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
    totalSubscriptionCount, // 【导出这个新变量】
    changeSubsPage,
    addSubscription,
    updateSubscription,
    deleteSubscription,
    deleteAllSubscriptions,
    addSubscriptionsFromBulk,
    handleUpdateNodeCount,
  };
}
