const fs = require('fs');
let file = 'apps/patient-web/components/appointments/BookAppointment.tsx';
let b = fs.readFileSync(file, 'utf8');

const oldStr = `<div className="flex bg-bg-notes rounded-lg overflow-hidden border border-border-card">
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
            </div>`;

const newStr = `<div className="grid grid-cols-3 bg-bg-notes rounded-lg overflow-hidden border border-border-card w-[180px]">
              <button 
                type="button"
                onClick={handlePrevMonth} 
                disabled={!step1Complete}
                className="py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors flex items-center justify-center text-lg"
              >
                &larr;
              </button>
              <div className="py-1.5 text-[11px] font-bold text-text-primary flex items-center justify-center border-x border-border-card uppercase tracking-wider text-center">
                {currentMonthView.toLocaleString('default', { month: 'short', year: 'numeric' })}
              </div>
              <button 
                type="button"
                onClick={handleNextMonth} 
                disabled={!step1Complete}
                className="py-1.5 text-text-secondary hover:text-brand-primary hover:bg-brand-primary/10 disabled:opacity-50 transition-colors flex items-center justify-center text-lg"
              >
                &rarr;
              </button>
            </div>`;

if (b.includes(oldStr)) {
    b = b.replace(oldStr, newStr);
    fs.writeFileSync(file, b);
    console.log("Replaced successfully.");
} else {
    console.log("Could not find the exact string.");
}
