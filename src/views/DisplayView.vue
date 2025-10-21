<template>
  <main class="main-container">
    <div class="mled-container">
      <MledStickyControls />
      <MledTextModule />
      <MledCoursewalksModule />
      <MledCountdownModule />
      <MledLinkModule />
      <MledDataModule />
    </div>
  </main>
</template>

<script setup>
import MledStickyControls from '@/components/display/MledStickyControls.vue'
import MledTextModule from '@/components/display/MledTextModule.vue'
import MledCoursewalksModule from '@/components/display/MledCoursewalksModule.vue'
import MledCountdownModule from '@/components/display/MledCountdownModule.vue'
import MledLinkModule from '@/components/display/MledLinkModule.vue'
import MledDataModule from '@/components/display/MledDataModule.vue'
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
