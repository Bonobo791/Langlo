<script lang="ts">
  import { page } from '$app/state';
</script>

<h1>Page unavailable</h1>
<p>Something went wrong. Please try again or return to the home page.</p>
{#if page.error?.correlationId}
  <p>Request reference: {page.error.correlationId}</p>
{/if}
