const fs = require('fs');
let content = fs.readFileSync('components/billing/BillingPayment.tsx', 'utf8');

const regex = /\}\n                  <\/div>\n                <\/div>\n              <\/div>\n([\s\S]+?)\s*\{\/\* Discount Selection \*\/\}/m;
const match = content.match(regex);
if (match) {
  content = content.replace(regex, `}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-8 bg-gray-50 rounded-lg text-gray-500 text-center border-2 border-dashed border-gray-300">
                No pending appointments with services to pay.
              </div>
            )}
          </div>

          {/* Discount Selection */}`);
  fs.writeFileSync('components/billing/BillingPayment.tsx', content);
  console.log('Fixed');
} else {
  console.log('Not found');
}
