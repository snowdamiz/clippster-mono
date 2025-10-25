<script setup lang="ts">
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from 'vue-sonner'

const switchValue = ref(true)
const inputValue = ref('')
const textareaValue = ref('')

const showToast = () => {
  toast('Dark mode is enabled', {
    description: 'Your app is using a dark theme for better visibility.',
  })
}
</script>

<template>
  <div class="space-y-8">
    <Card>
      <CardHeader>
        <CardTitle>Theme Configuration</CardTitle>
        <CardDescription>
          This app is configured to use dark mode only for a consistent experience.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div class="flex items-center space-x-2">
          <Switch id="dark-mode" v-model:checked="switchValue" disabled />
          <Label for="dark-mode">Dark Mode (Always On)</Label>
        </div>
      </CardContent>
    </Card>

    <Alert>
      <AlertTitle>Dark Mode Active</AlertTitle>
      <AlertDescription>
        The application is running in dark mode. All components are styled for optimal visibility in dark environments.
      </AlertDescription>
    </Alert>

    <Tabs default-value="components" class="w-full">
      <TabsList class="grid w-full grid-cols-2">
        <TabsTrigger value="components">Components</TabsTrigger>
        <TabsTrigger value="forms">Forms</TabsTrigger>
      </TabsList>
      <TabsContent value="components">
        <Card>
          <CardHeader>
            <CardTitle>Component Examples</CardTitle>
            <CardDescription>
              Common UI components styled for dark mode
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex gap-2">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <Separator />
            <div class="flex gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="outline">Outline</Badge>
              <Badge variant="destructive">Destructive</Badge>
            </div>
          </CardContent>
          <CardFooter>
            <Button @click="showToast" class="w-full">
              Show Toast Notification
            </Button>
          </CardFooter>
        </Card>
      </TabsContent>
      <TabsContent value="forms">
        <Card>
          <CardHeader>
            <CardTitle>Form Elements</CardTitle>
            <CardDescription>
              Input components for dark mode
            </CardDescription>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="space-y-2">
              <Label for="input">Text Input</Label>
              <Input 
                id="input" 
                v-model="inputValue" 
                placeholder="Enter some text..." 
              />
            </div>
            <div class="space-y-2">
              <Label for="textarea">Textarea</Label>
              <Textarea 
                id="textarea" 
                v-model="textareaValue" 
                placeholder="Enter longer text..."
                rows="4"
              />
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  </div>
</template>