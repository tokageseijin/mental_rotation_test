// Shared confirmation for leaving an in-progress quiz session. Leaving discards
// the session; the Quiz page returns to model selection and a fresh session is
// started next time. Kept in one place so the wording matches everywhere.
export function confirmLeaveQuiz(): boolean {
  return window.confirm('クイズを終了しますか？（現在のセッションは破棄され、オブジェクト選択からやり直しになります）');
}
