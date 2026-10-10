<script lang="ts">
  let {
    label,
    symbol,
    variant
  }: {
    label: string;
    symbol: string;
    variant: 'mastery' | 'schedule' | 'outcome' | 'neutral';
  } = $props();
</script>

<span class="chip chip-{variant}">
  <span class="mark" aria-hidden="true">{symbol}</span>{label}
</span>

<style>
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.1rem 0.55rem;
    border: 1px solid #b8c6d8;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 600;
    white-space: nowrap;
  }
  .mark {
    font-size: 0.9em;
  }
  .chip-mastery {
    background: #eef4fb;
  }
  .chip-schedule {
    background: #f3efe4;
  }
  .chip-outcome {
    background: #e8f3ec;
  }
  .chip-neutral {
    background: #f2f3f5;
  }
</style>
