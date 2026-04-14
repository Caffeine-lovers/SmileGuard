const fs = require('fs');
let file = 'apps/patient-web/components/appointments/BookAppointment.tsx';
let b = fs.readFileSync(file, 'utf8');

const s1 = b.indexOf('<div className="flex bg-bg-notes rounded-lg overflow-hidden border border-border-card">');
const s2 = b.indexOf('</button>', s1 + 100);
const s3 = b.indexOf('</button>', s2 + 10);
const s4 = b.indexOf('</div>', s3 + 10) + 6;

if (s1 > 0 && s4 > s1) {
const newStr = `<div className="grid grid-cols-[1fr_2fr_1fr] bg-bg-notes rounded-lg overflow-hidden border border-border-card w-[200px]">
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

    b = b.substring(0, s1) + newStr + b.substring(s4);
    fs.writeFileSync(file, b);
    console.log("Replaced successfully with index splicing.");
} else {
    console.log("Could not find boundaries.");
}
