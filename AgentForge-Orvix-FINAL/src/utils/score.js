export function getScoreTone(score) {
  if (score >= 80) {
    return {
      text: 'text-success',
      background: 'bg-success-light',
      bar: 'bg-success',
    }
  }

  if (score >= 60) {
    return {
      text: 'text-warning',
      background: 'bg-warning-light',
      bar: 'bg-warning',
    }
  }

  return {
    text: 'text-danger',
    background: 'bg-danger-light',
    bar: 'bg-danger',
  }
}

export function getSandboxAverage(score) {
  if (!score) return null
  return Math.round((score.reliability + score.security + score.toolCoverage) / 3)
}