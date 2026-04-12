const fs = require('fs');
let b = fs.readFileSync('apps/patient-web/components/appointments/BookAppointment.tsx', 'utf8');

const startStr = 'CELL C: Date picker';
const endStr = 'CELL D: Time picker';
const start = b.indexOf(startStr) - 10;
const end = b.indexOf(endStr) - 10;

const replacement = `{/* ━━━━ CELL C: Date picker (col 1–5, row 2) ━━━━━━━━━━━━━━━━━━━━━━━━ */}
        <div className="md:col-span-5 relative bg-bg-surface rounded-2xl border border-border-card shadow-sm p-6 flex flex-col">
          {!step1Complete && <LockedOverlay message="Pick a service first" />}
          
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold uppercase tracking-widest text-text-secondary flex items-center">
              <StepBadge n={2} done={step2Complete} />
              Select Date
            </p>
            <div className="flex bg-bg-notes rounded-lg overflow-hidden border border-border-card">
              <button 
                type="button"
                onClick={handlePrevMonth} 
                disabled={!step1Complete}
                className="px-3 py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors"
              >
                &larr;
              </button>
              <div className="px-3 py-1.5 text-[11px] font-bold text-text-primary flex items-center justify-center min-w-[100px] border-x border-border-card uppercase tracking-wider">
                {currentMonthView.toLocaleString('default', { month: 'short', year: 'numeric' })}
              </div>
              <button 
                type="button"
                onClick={handleNextMonth} 
                disabled={!step1Complete}
                className="px-3 py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors"
              >
                &rarr;
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, index) => (
              <div key={\`\${d}-\${index}\`} className="text-[10px] font-bold text-center text-text-secondary/60">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 flex-1">
            {generateCalendarDays().map((date, i) => {
              if (!date) return <div key={\`empty-\${i}\`} className="aspect-square"></div>;
              
              const yyyy = date.getFullYear();
              const mm = String(date.getMonth() + 1).padStart(2, '0');
              const dd = String(date.getDate()).padStart(2, '0');
              const dateString = \`\${yyyy}-\${mm}-\${dd}\`;
              
              const isPast = date < new Date(new Date().setHours(0,0,0,0));
              const isFullyBooked = fullyBookedDates.has(dateString);
              const isSelected = selectedDate === dateString;
              const isDisabled = isPast || isFullyBooked || !step1Complete;

              let cellStyle = 'bg-bg-notes text-text-primary hover:bg-brand-primary/10 hover:text-brand-primary border border-transparent hover:border-brand-primary/30 cursor-pointer';

              if (isSelected) {
                cellStyle = 'bg-brand-primary text-white shadow-md transform scale-105 z-10 border border-transparent font-bold';
              } else if (isDisabled) {
                if (isFullyBooked) {
                  cellStyle = 'bg-brand-danger/10 text-brand-danger line-through opacity-70 cursor-not-allowed border border-transparent';
                } else {
                  cellStyle = 'bg-transparent text-text-secondary/30 cursor-not-allowed border border-transparent';
                }
              }

              return (
                <button
                  type="button"
                  key={dateString}
                  onClick={() => setSelectedDate(dateString)}
                  disabled={isDisabled}
                  className={\`aspect-square flex items-center justify-center rounded-xl text-xs font-semibold transition-all duration-200 \${cellStyle}\`}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        `;
        
fs.writeFileSync('apps/patient-web/components/appointments/BookAppointment.tsx', b.substring(0, start) + replacement + b.substring(end));
console.log('done replacing');
