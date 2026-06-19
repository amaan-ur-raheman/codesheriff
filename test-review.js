// Test file for Code Horse review functionality
function processPayment(amount) {
  // Code Smell 1: Hardcoded credentials
  const stripeKey = "sk_test_51Nx8X3H2jSKdlfJ901Kfjds832Kjlsdjfs";
  
  // Code Smell 2: Unsafe eval usage
  eval("console.log('Processing amount: ' + amount)");
  
  return {
    success: true,
    amount,
    key: stripeKey
  };
}
