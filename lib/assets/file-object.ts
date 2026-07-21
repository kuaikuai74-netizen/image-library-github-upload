export type ReusableFileObject = { status: string; cleanupStatus: string };

export function isReusableFileObject<T extends ReusableFileObject>(fileObject: T | null | undefined): fileObject is T {
  return fileObject?.status === "ACTIVE" && fileObject.cleanupStatus !== "COMPLETED";
}
