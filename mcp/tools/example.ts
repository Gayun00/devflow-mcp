export async function getTime() {
  return { time: new Date().toISOString() };
}
