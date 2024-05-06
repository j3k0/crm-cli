import enquirer from 'enquirer';

export const doYouConfirm = async (message?: string) => {
  if (message)
      console.log(message);
  const confirm = await enquirer.prompt({
      type: 'autocomplete',
      name: 'value',
      message: 'Do you confirm?',
      choices: ['Confirm', 'Cancel'],
  });
  if (!confirm || confirm.value !== 'Confirm') {
      console.log('Canceled');
      process.exit(1);
  }
};
