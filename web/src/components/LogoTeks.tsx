/** Logo teks HRBoost (web/public/brand). "cerah" untuk latar cerah, "putih" / "gelap" untuk latar gelap. */
const FAIL = { cerah: "hrboost-wordmark", putih: "hrboost-wordmark-white", gelap: "hrboost-wordmark-dark" } as const;
const NISBAH = 420.7 / 76;

export function LogoTeks({ varian = "cerah", tinggi = 22, className }: { varian?: keyof typeof FAIL; tinggi?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/${FAIL[varian]}.svg`}
      alt="HRBoost"
      width={Math.round(tinggi * NISBAH)}
      height={tinggi}
      className={className}
      style={{ height: tinggi, width: "auto" }}
    />
  );
}
