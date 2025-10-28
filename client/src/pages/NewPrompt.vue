<template>
  <PageLayout
    title="New Prompt"
    description="Create a new AI prompt template for your video editing workflow"
    :show-header="true"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <!-- Main Form - Left Side (2/3 width) -->
      <div class="lg:col-span-2">
        <!-- Form Card -->
        <div class="bg-card border border-border rounded-xl p-6 shadow-sm">
          <form @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Name Field -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="name" class="block text-sm font-medium text-foreground">
                  Prompt Name
                  <span class="text-red-500 ml-1">*</span>
                </label>
                <span class="text-xs text-muted-foreground">{{ formData.name.length }}/100</span>
              </div>
              <input
                id="name"
                ref="nameInput"
                v-model="formData.name"
                type="text"
                maxlength="100"
                placeholder="e.g., Viral Shorts Creator, Tutorial Intro Template"
                class="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground transition-all"
                required
                :class="{ 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10': nameError }"
                @blur="validateName"
              />
              <p v-if="nameError" class="text-xs text-red-500 flex items-center gap-1.5 mt-1">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ nameError }}
              </p>
            </div>

            <!-- Content Field -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label for="content" class="block text-sm font-medium text-foreground">
                  Prompt Content
                  <span class="text-red-500 ml-1">*</span>
                </label>
                <div class="flex items-center gap-3">
                  <span class="text-xs text-muted-foreground">{{ characterCount }} characters</span>
                  <span class="text-xs text-muted-foreground">≈ {{ wordCount }} words</span>
                </div>
              </div>
              <div class="relative">
                <textarea
                  id="content"
                  v-model="formData.content"
                  placeholder="Write your AI prompt here... Be specific about the task and desired output."
                  rows="14"
                  class="w-full px-3.5 py-2.5 bg-background border border-border rounded-lg focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/10 text-foreground placeholder:text-muted-foreground resize-y transition-all font-mono text-sm leading-relaxed"
                  required
                  :class="{ 'border-red-500/50 focus:border-red-500/50 focus:ring-red-500/10': contentError }"
                  @blur="validateContent"
                ></textarea>
                <!-- Character limit indicator -->
                <div 
                  v-if="formData.content.length > 0"
                  class="absolute bottom-3 right-3 flex items-center gap-2"
                >
                  <button
                    type="button"
                    @click="clearContent"
                    class="p-1.5 bg-background/80 backdrop-blur-sm hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-foreground"
                    title="Clear content"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <p v-if="contentError" class="text-xs text-red-500 flex items-center gap-1.5">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clip-rule="evenodd" />
                </svg>
                {{ contentError }}
              </p>
            </div>

            <!-- Actions -->
            <div class="flex items-center justify-between">
              <button
                type="button"
                @click="handleCancel"
                class="px-5 py-2.5 text-muted-foreground hover:text-foreground font-medium transition-all flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clip-rule="evenodd" />
                </svg>
                Cancel
              </button>
              <div class="flex items-center gap-3">
                <button
                  v-if="formData.name || formData.content"
                  type="button"
                  @click="resetForm"
                  class="px-4 py-2 bg-muted hover:bg-muted/80 text-foreground rounded-lg font-medium transition-all flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clip-rule="evenodd" />
                  </svg>
                  Reset
                </button>
                <button
                  type="submit"
                  :disabled="saving || !isFormValid"
                  class="px-5 py-2.5 bg-gradient-to-br from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white rounded-lg font-medium shadow-lg shadow-purple-500/20 hover:shadow-xl hover:shadow-purple-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center gap-2"
                >
                  <svg v-if="!saving" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  <svg v-else class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {{ saving ? 'Saving...' : 'Save Prompt' }}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <!-- Tips & Help - Right Side (1/3 width) -->
      <div class="space-y-4">
        <!-- Quick Tips Card -->
        <div class="bg-gradient-to-br from-purple-500/5 to-indigo-500/5 border border-purple-500/20 rounded-xl p-5 space-y-3">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 bg-purple-500/10 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <h3 class="font-medium text-foreground">Quick Tips</h3>
          </div>
          <ul class="space-y-2.5 text-sm text-muted-foreground">
            <li class="flex items-start gap-2">
              <svg class="h-4 w-4 text-green-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Be specific about the task and desired output</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Create reusable templates for common tasks</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Include context about video style and tone</span>
            </li>
            <li class="flex items-start gap-2">
              <svg class="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
              </svg>
              <span>Test and refine your prompts iteratively</span>
            </li>
          </ul>
        </div>

        <!-- Example Templates Card -->
        <div class="bg-card border border-border rounded-xl p-5 space-y-3">
          <div class="flex items-center gap-2.5">
            <div class="p-1.5 bg-muted rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-foreground" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
              </svg>
            </div>
            <h3 class="font-medium text-foreground">Example Templates</h3>
          </div>
          <div class="space-y-2">
            <button
              v-for="(example, index) in examples"
              :key="index"
              type="button"
              @click="loadExample(example)"
              class="w-full text-left p-3 bg-muted/30 hover:bg-muted/50 rounded-lg transition-all group border border-border/50 hover:border-foreground/20 hover:shadow-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-foreground group-hover:text-foreground transition-colors mb-1">{{ example.name }}</p>
                  <p class="text-xs text-muted-foreground group-hover:text-foreground/70 transition-colors line-clamp-2">{{ example.preview }}</p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-all flex-shrink-0 group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" />
                </svg>
              </div>
            </button>
          </div>
        </div>

      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { createPrompt } from '@/services/database'
import PageLayout from '@/components/PageLayout.vue'

const router = useRouter()
const saving = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
const nameError = ref('')
const contentError = ref('')

const formData = reactive({
  name: '',
  content: ''
})

interface Example {
  name: string
  preview: string
  content: string
}

const examples: Example[] = [
  {
    name: 'Viral Shorts Creator',
    preview: 'Create engaging short-form content optimized for viral reach',
    content: `Create a 30-60 second viral short video script.

Requirements:
- Hook viewers in the first 3 seconds with a compelling question or statement
- Use trending audio/music that fits the content
- Include text overlays for key points and emphasis
- End with a strong call-to-action (like, follow, comment)
- Optimize for vertical mobile viewing (9:16)
- Keep pacing fast and energetic

Format the output as a structured script with timestamps, visual descriptions, and text overlay suggestions. Include suggestions for B-roll footage and transitions.`
  },
  {
    name: 'Tutorial Introduction',
    preview: 'Professional intro for educational and how-to videos',
    content: `Create an engaging 20-30 second introduction for a tutorial video.

Include:
1. Brief hook explaining the problem viewers want to solve
2. What viewers will learn by the end of the video
3. A brief credibility statement
4. Quick teaser showing the final result

Tone: Professional yet approachable. Keep it concise and energetic. Avoid overpromising. Use conversational language that builds trust with the audience.`
  },
  {
    name: 'Product Showcase',
    preview: 'Highlight product features and benefits effectively',
    content: `Create a compelling 60-90 second product showcase video script.

Structure:
1. Problem statement - What pain point does this product solve?
2. Product introduction with clear value proposition
3. Demonstrate 3-5 key features with visual examples
4. Show real-world use cases and benefits
5. Include social proof or testimonials if available
6. Strong call-to-action with limited-time offer or special deal

Focus on benefits over features. Show, don't just tell. Use lifestyle shots that help viewers envision themselves using the product.`
  },
  {
    name: 'Storytime Narrative',
    preview: 'Engaging storytelling format for personal or brand stories',
    content: `Write a compelling 2-3 minute storytime narrative script.

Structure:
- Setup: Introduce the situation, setting, and key people involved
- Conflict: Present the main challenge or turning point that creates tension
- Resolution: Show how the situation was resolved and what changed
- Reflection: Connect the story to a broader lesson or meaning

Include natural pauses for dramatic effect, emphasis points for key moments, and emotional beats that help viewers connect. Make it relatable and authentic. Use present tense to make it more immediate and engaging.`
  }
]

const characterCount = computed(() => formData.content.length)
const wordCount = computed(() => {
  const words = formData.content.trim().split(/\s+/)
  return words[0] === '' ? 0 : words.length
})

const isFormValid = computed(() => {
  return formData.name.trim().length > 0 && 
         formData.content.trim().length > 0 &&
         !nameError.value &&
         !contentError.value
})

function validateName() {
  if (!formData.name.trim()) {
    nameError.value = 'Prompt name is required'
  } else if (formData.name.trim().length < 3) {
    nameError.value = 'Name must be at least 3 characters'
  } else {
    nameError.value = ''
  }
}

function validateContent() {
  if (!formData.content.trim()) {
    contentError.value = 'Prompt content is required'
  } else if (formData.content.trim().length < 10) {
    contentError.value = 'Content must be at least 10 characters'
  } else {
    contentError.value = ''
  }
}

function clearContent() {
  formData.content = ''
  contentError.value = ''
}

function resetForm() {
  formData.name = ''
  formData.content = ''
  nameError.value = ''
  contentError.value = ''
  nameInput.value?.focus()
}

function loadExample(example: Example) {
  formData.name = example.name
  formData.content = example.content
  nameError.value = ''
  contentError.value = ''
  // Scroll to top smoothly
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleSubmit() {
  validateName()
  validateContent()
  
  if (!isFormValid.value) {
    return
  }

  saving.value = true
  try {
    await createPrompt(formData.name.trim(), formData.content.trim())
    // Navigate back to prompts list
    router.push('/dashboard/prompts')
  } catch (error) {
    console.error('Failed to create prompt:', error)
    // TODO: Add error notification
  } finally {
    saving.value = false
  }
}

function handleCancel() {
  router.push('/dashboard/prompts')
}

onMounted(() => {
  // Auto-focus the name input
  nameInput.value?.focus()
})
</script>
