import { ref } from 'vue'

// Global reactive ref for breadcrumb title
const breadcrumbTitle = ref<string>('')

export function useBreadcrumb() {
  const setBreadcrumbTitle = (title: string) => {
    breadcrumbTitle.value = title
  }

  const clearBreadcrumbTitle = () => {
    breadcrumbTitle.value = ''
  }

  return {
    breadcrumbTitle,
    setBreadcrumbTitle,
    clearBreadcrumbTitle
  }
}
