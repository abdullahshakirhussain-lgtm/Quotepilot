/**
 * While a page loads: grey shapes where the dashboard's parts will be (the
 * headline, the people to follow up, the three numbers and the money bar),
 * so nothing jumps when it arrives.
 */
export default function Loading() {
  const bar = "rounded-[6px] bg-stone-100";
  return (
    <div role="status" aria-label="Loading" className="ql-fade flex flex-col gap-4">
      <div className={`h-7 w-64 max-w-full ${bar}`} />
      <div className="card flex flex-col divide-y divide-[#ECEEF1]">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 px-5 py-3.5">
            <div className="flex flex-1 flex-col gap-2">
              <div className={`h-4 w-36 ${bar}`} />
              <div className={`h-3 w-20 ${bar}`} />
            </div>
            <div className={`h-4 w-16 ${bar}`} />
            <div className={`h-9 w-16 ${bar}`} />
          </div>
        ))}
      </div>
      <div className="card grid grid-cols-1 divide-y divide-[#ECEEF1] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex flex-col gap-2 px-5 py-3.5">
            <div className={`h-3.5 w-16 ${bar}`} />
            <div className={`h-6 w-28 ${bar}`} />
          </div>
        ))}
      </div>
      <div className="card flex flex-col gap-3 px-5 py-4">
        <div className={`h-4 w-40 ${bar}`} />
        <div className={`h-7 w-full ${bar}`} />
      </div>
    </div>
  );
}
