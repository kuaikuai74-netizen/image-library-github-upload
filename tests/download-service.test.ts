import { describe, expect, it } from "vitest";
import { downloadHeaders } from "../lib/assets/download-service";

describe("download headers", () => {
  it("uses an ASCII fallback while preserving UTF-8 filenames", () => {
    const headers = downloadHeaders("Vertex_Lift_01_法国_A+详情页_01.png", "image/png");

    expect(() => new Headers(headers)).not.toThrow();
    expect(headers["Content-Disposition"]).toContain('filename="Vertex_Lift_01____A+____01.png"');
    expect(headers["Content-Disposition"]).toContain("filename*=UTF-8''Vertex_Lift_01_%E6%B3%95%E5%9B%BD_A%2B%E8%AF%A6%E6%83%85%E9%A1%B5_01.png");
  });
});
