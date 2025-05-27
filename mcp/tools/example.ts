export async function getTime() {
  return { time: new Date().toISOString() };
  // 테스트용 주석 추가
}
