/**
 * While a page loads: grey shapes where the dashboard's cards will be (the
 * overview, follow up now, and the quote list), so nothing jumps when it arrives.
 */
export default function Loading() {
  const bar = "rounded-[6px] bg-stone-100";
  return (
    <div role="status" aria-label="Loading" className="ql-fade flex flex-col gap-4">
      <div className={`h-6 w-48 ${bar}`} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="card flex items-center gap-6 p-5">
          <div className="h-[132px] w-[132px] shrink-0 rounded-full border-[16px] border-stone-100" />
          <div className="flex flex-1 flex-col gap-3">
            <div className={`h-4 w-2/3 ${bar}`} />
            <div className={`h-4 w-1/2 ${bar}`} />
            <div className={`h-4 w-3/5 ${bar}`} />
          </div>
        </div>
        <div className="card flex flex-col gap-3 p-5">
          <div className={`h-5 w-32 ${bar}`} />
          <div className={`h-10 w-full ${bar}`} />
          <div className={`h-10 w-full ${bar}`} />
        </div>
      </div>
      <div className="card flex flex-col gap-3 p-5">
        <div className={`h-5 w-36 ${bar}`} />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className={`h-9 w-full ${bar}`} />
        ))}
      </div>
    </div>
  );
}
