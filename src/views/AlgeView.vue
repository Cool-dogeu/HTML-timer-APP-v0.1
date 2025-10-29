<template>
  <main class="main-container">
    <div class="mled-container">
      <AlgeStickyControls />
      <AlgeCoursewalksModule />
      <AlgeLinkModule />
    </div>
  </main>
</template>

<script setup>
import AlgeStickyControls from '@/components/alge/AlgeStickyControls.vue'
import AlgeCoursewalksModule from '@/components/alge/AlgeCoursewalksModule.vue'
import AlgeLinkModule from '@/components/alge/AlgeLinkModule.vue'
</script>

<style scoped>
/* Component-specific styles if needed - most styles are in main.css */
</style>
