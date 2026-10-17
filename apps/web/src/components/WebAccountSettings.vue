<template><AccountSettingsDialog :show="true" :desktop-tools-available="false" @close="close" /></template>
<script setup lang="ts">
import { onMounted } from 'vue'
import AccountSettingsDialog from '@/components/AccountSettingsDialog.vue'
import { useUserPreferencesStore } from '../workspacePreferences'
import { useToast } from '../toasts'
function close(){window.parent.postMessage({type:'clippster-settings-close'},location.origin)}
onMounted(()=>{document.documentElement.style.background='transparent';document.body.style.background='transparent';void useUserPreferencesStore().loadPreferences().catch(error=>useToast().error('Could not load preferences',error.message))})
</script>
