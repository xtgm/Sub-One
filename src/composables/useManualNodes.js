// FILE: src/composables/useManualNodes.js
import { ref, computed, watch } from 'vue';
import { useToastStore } from '../stores/toast.js';

// 【修改】新增第三个参数 triggerAutoSave
export function useManualNodes(initialNodesRef, markDirty, triggerAutoSave) {
  const { showToast } = useToastStore();
  const manualNodes = ref([]);
  const manualNodesCurrentPage = ref(1);
  const manualNodesPerPage = 24;
  const searchTerm = ref('');

  // 辅助函数：执行保存并刷新（如果有提供回调）
  const tryAutoSave = async (msg) => {
    if (typeof triggerAutoSave === 'function') {
        if(msg) showToast(msg, 'success');
        await triggerAutoSave(); // 调用外部传入的保存并刷新逻辑
    } else {
        if (markDirty) markDirty(); // 如果没有配置自动保存，则回退到原来的“标记为未保存”
    }
  };

  // 国家/地区代码映射 (保持原样)
  const countryCodeMap = {
    'hk': ['🇭🇰', '香港'], 'tw': ['🇹🇼', '台湾', '臺灣'], 'sg': ['🇸🇬', '新加坡', '狮城'], 'jp': ['🇯🇵', '日本'],
    'us': ['🇺🇸', '美国', '美國'], 'kr': ['🇰🇷', '韩国', '韓國'], 'gb': ['🇬🇧', '英国', '英國'], 'de': ['🇩🇪', '德国', '德國'],
    'fr': ['🇫🇷', '法国', '法國'], 'ca': ['🇨🇦', '加拿大'], 'au': ['🇦🇺', '澳大利亚', '澳洲', '澳大利亞'],
    'cn': ['🇨🇳', '中国', '大陸', '内地'], 'my': ['🇲🇾', '马来西亚', '馬來西亞'], 'th': ['🇹🇭', '泰国', '泰國'],
    'vn': ['🇻🇳', '越南'], 'ph': ['🇵🇭', '菲律宾', '菲律賓'], 'id': ['🇮🇩', '印度尼西亚', '印尼'], 'in': ['🇮🇳', '印度'],
    'pk': ['🇵🇰', '巴基斯坦'], 'bd': ['🇧🇩', '孟加拉国', '孟加拉國'], 'ae': ['🇦🇪', '阿联酋', '阿聯酋'], 'sa': ['🇸🇦', '沙特阿拉伯'],
    'tr': ['🇹🇷', '土耳其'], 'ru': ['🇷🇺', '俄罗斯', '俄羅斯'], 'br': ['🇧🇷', '巴西'], 'mx': ['🇲🇽', '墨西哥'],
    'ar': ['🇦🇷', '阿根廷'], 'cl': ['🇨🇱', '智利'], 'za': ['🇿🇦', '南非'], 'eg': ['🇪🇬', '埃及'], 'ng': ['🇳🇬', '尼日利亚', '尼日利亞'],
    'ke': ['🇰🇪', '肯尼亚', '肯尼亞'], 'il': ['🇮🇱', '以色列'], 'ir': ['🇮🇷', '伊朗'], 'iq': ['🇮🇶', '伊拉克'],
    'ua': ['🇺🇦', '乌克兰', '烏克蘭'], 'pl': ['🇵🇱', '波兰', '波蘭'], 'cz': ['🇨🇿', '捷克'], 'hu': ['🇭🇺', '匈牙利'],
    'ro': ['🇷🇴', '罗马尼亚', '羅馬尼亞'], 'gr': ['🇬🇷', '希腊', '希臘'], 'pt': ['🇵🇹', '葡萄牙'], 'es': ['🇪🇸', '西班牙'],
    'it': ['🇮🇹', '意大利'], 'nl': ['🇳🇱', '荷兰', '荷蘭'], 'be': ['🇧🇪', '比利时', '比利時'], 'se': ['🇸🇪', '瑞典'],
    'no': ['🇳🇴', '挪威'], 'dk': ['🇩🇰', '丹麦', '丹麥'], 'fi': ['🇫🇮', '芬兰', '芬蘭'], 'ch': ['🇨🇭', '瑞士'],
    'at': ['🇦🇹', '奥地利', '奧地利'], 'ie': ['🇮🇪', '爱尔兰', '愛爾蘭'], 'nz': ['🇳🇿', '新西兰', '紐西蘭'],
  };

  function initializeManualNodes(nodesData) {
    manualNodes.value = (nodesData || []).map(node => ({
      ...node,
      id: node.id || crypto.randomUUID(),
      enabled: node.enabled ?? true,
    }));
  }

  const totalManualNodeCount = computed(() => manualNodes.value.length);

  const filteredManualNodes = computed(() => {
    if (!searchTerm.value) return manualNodes.value;
    const lowerCaseSearch = searchTerm.value.toLowerCase();
    const alternativeTerms = countryCodeMap[lowerCaseSearch] || [];
    
    return manualNodes.value.filter(node => {
      const nodeNameLower = node.name ? node.name.toLowerCase() : '';
      if (nodeNameLower.includes(lowerCaseSearch)) return true;
      for (const altTerm of alternativeTerms) {
        if (nodeNameLower.includes(altTerm.toLowerCase())) return true;
      }
      return false;
    });
  });
  
  const manualNodesTotalPages = computed(() => Math.ceil(filteredManualNodes.value.length / manualNodesPerPage));

  const paginatedManualNodes = computed(() => {
    const start = (manualNodesCurrentPage.value - 1) * manualNodesPerPage;
    const end = start + manualNodesPerPage;
    return filteredManualNodes.value.slice(start, end);
  });
  
  const enabledManualNodes = computed(() => manualNodes.value.filter(n => n.enabled));

  function changeManualNodesPage(page) {
    if (page < 1 || page > manualNodesTotalPages.value) return;
    manualNodesCurrentPage.value = page;
  }

  function addNode(node) {
    manualNodes.value.unshift(node);
    const currentPageItems = paginatedManualNodes.value.length;
    if (currentPageItems >= manualNodesPerPage) {
      manualNodesCurrentPage.value = 1;
    }
    tryAutoSave('节点已添加，正在保存...'); // 【修改】自动保存
  }

  function updateNode(updatedNode) {
    const index = manualNodes.value.findIndex(n => n.id === updatedNode.id);
    if (index !== -1) {
      manualNodes.value[index] = updatedNode;
      if (markDirty) markDirty(); // 编辑通常比较频繁，可以先不强制刷新，或者你也改成 tryAutoSave
    }
  }

  function deleteNode(nodeId) {
    const index = manualNodes.value.findIndex(n => n.id === nodeId);
    if (index !== -1) {
      manualNodes.value.splice(index, 1);
      // 【修改】删除后尝试自动保存并刷新
      tryAutoSave('节点已删除，正在保存并刷新...');
    }
    
    if (paginatedManualNodes.value.length === 0 && manualNodesCurrentPage.value > 1) {
      manualNodesCurrentPage.value--;
    }
  }

  function deleteAllNodes() {
    manualNodes.value.splice(0, manualNodes.value.length);
    manualNodesCurrentPage.value = 1;
    searchTerm.value = '';
    tryAutoSave('所有手动节点已清空，正在刷新...'); // 【修改】自动保存
  }

  function addNodesFromBulk(nodes) {
    manualNodes.value.unshift(...nodes);
    manualNodesCurrentPage.value = 1;
    tryAutoSave('批量导入成功，正在保存...'); // 【修改】自动保存
  }

  const getUniqueKey = (url) => {
    try {
      if (url.startsWith('vmess://')) {
        const base64Part = url.substring('vmess://'.length);
        const decodedString = atob(base64Part);
        const cleanedString = decodedString.replace(/\s/g, '');
        const nodeConfig = JSON.parse(cleanedString);
        delete nodeConfig.ps;
        delete nodeConfig.remark;
        return 'vmess://' + JSON.stringify(Object.keys(nodeConfig).sort().reduce((obj, key) => { obj[key] = nodeConfig[key]; return obj; }, {}));
      }
      const hashIndex = url.indexOf('#');
      return hashIndex !== -1 ? url.substring(0, hashIndex) : url;
    } catch (e) {
      console.error('生成节点唯一键失败:', url, e);
      return url;
    }
  };

  function deduplicateNodes() {
    const originalCount = manualNodes.value.length;
    const seenKeys = new Set();
    const uniqueNodes = [];
    for (const node of manualNodes.value) {
      const uniqueKey = getUniqueKey(node.url);
      if (!seenKeys.has(uniqueKey)) {
        seenKeys.add(uniqueKey);
        uniqueNodes.push(node);
      }
    }
    manualNodes.value = uniqueNodes;
    const removedCount = originalCount - uniqueNodes.length;
    if (removedCount > 0) {
      tryAutoSave(`成功移除 ${removedCount} 个重复节点，正在保存...`); // 【修改】自动保存
    } else {
      showToast('没有发现重复的节点。', 'info');
    }
  }

  function autoSortNodes() {
    // ... (保持排序逻辑不变)
    const regionKeywords = {
      HK: [/香港/, /HK/, /Hong Kong/i], TW: [/台湾/, /TW/, /Taiwan/i], SG: [/新加坡/, /SG/, /Singapore/i],
      JP: [/日本/, /JP/, /Japan/i], US: [/美国/, /US/, /United States/i], KR: [/韩国/, /KR/, /Korea/i],
      GB: [/英国/, /GB/, /UK/i], DE: [/德国/, /DE/, /Germany/i], FR: [/法国/, /FR/, /France/i],
      CA: [/加拿大/, /CA/, /Canada/i], AU: [/澳大利亚/, /AU/, /Australia/i]
    };
    const regionOrder = ['HK', 'TW', 'SG', 'JP', 'US', 'KR', 'GB', 'DE', 'FR', 'CA', 'AU'];
    const regionCodeCache = new Map();
    const getRegionCode = (name) => {
      if (regionCodeCache.has(name)) return regionCodeCache.get(name);
      for (const [code, keywords] of Object.entries(regionKeywords)) {
        if (keywords.some(k => k.test(name))) { regionCodeCache.set(name, code); return code; }
      }
      regionCodeCache.set(name, 'ZZ'); return 'ZZ';
    };
    
    manualNodes.value.sort((a, b) => {
      const regionA = getRegionCode(a.name);
      const regionB = getRegionCode(b.name);
      const indexA = regionOrder.indexOf(regionA);
      const indexB = regionOrder.indexOf(regionB);
      const effectiveIndexA = indexA === -1 ? Infinity : indexA;
      const effectiveIndexB = indexB === -1 ? Infinity : indexB;
      if (effectiveIndexA !== effectiveIndexB) return effectiveIndexA - effectiveIndexB;
      return a.name.localeCompare(b.name, 'zh-CN');
    });

    tryAutoSave('节点排序完成，正在保存...'); // 【修改】自动保存
  }

  watch(searchTerm, () => {
    manualNodesCurrentPage.value = 1;
  });

  watch(initialNodesRef, (newInitialNodes) => {
    initializeManualNodes(newInitialNodes);
  }, { immediate: true, deep: true });

  return {
    manualNodes,
    manualNodesCurrentPage,
    manualNodesTotalPages,
    paginatedManualNodes,
    enabledManualNodesCount: computed(() => enabledManualNodes.value.length),
    totalManualNodeCount,
    searchTerm,
    changeManualNodesPage,
    addNode,
    updateNode,
    deleteNode,
    deleteAllNodes,
    addNodesFromBulk,
    autoSortNodes,
    deduplicateNodes,
  };
}
