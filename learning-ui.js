const LearningUI = (() => {
  const moodIcons = {welcome:'spark', help:'light', success:'check', retry:'retry', finish:'flag'};

  function icon(name) {
    return `<svg class="ui-icon" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><use href="icons.svg?v=3.4.0#${name}"></use></svg>`;
  }

  function mascot(mood) {
    return `<div class="xanny-mood xanny-mood--${mood}" aria-hidden="true"><img src="xanny.svg?v=3.4.0" width="54" height="54" alt=""><span>${icon(moodIcons[mood])}</span></div>`;
  }

  return {icon, mascot};
})();
