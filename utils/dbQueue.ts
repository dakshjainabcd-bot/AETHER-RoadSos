/**
 * Global Database Queue
 * 
 * expo-sqlite on Android has a known issue where concurrent calls to 
 * NativeDatabase.prepareAsync can cause a NullPointerException.
 * To prevent this, we serialize all SQLite queries across the entire app
 * using a single global promise queue.
 */
let globalDbQueue = Promise.resolve<any>(null);

export async function runInDbQueue<T>(task: () => Promise<T>): Promise<T> {
    const p = globalDbQueue.then(task, task);
    globalDbQueue = p.catch(() => {});
    return p;
}
