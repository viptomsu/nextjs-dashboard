'use server';

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const FormSchema = z.object({
  id: z.string(),
  customerId: z.string({
    invalid_type_error: 'Please select a customer',
  }),
  amount: z.coerce.number().gt(0, {
    message: 'Please enter an mount greater than $0',
  }),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status',
  }),
  date: z.string(),
});

const InvoiceSchema = FormSchema.omit({ id: true, date: true });

export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
};

export async function updateInvoice(
  id: string | undefined,
  prevState: State,
  formData: FormData,
) {
  const msgError = `Failed to ${id ? 'Update' : 'Create'} Invoice.`;
  const validatedFields = InvoiceSchema.safeParse({
    customerId: formData.get('customerId'),
    amount: formData.get('amount'),
    status: formData.get('status'),
  });

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: 'Missing Fields. ' + msgError,
    };
  }

  validatedFields.data.amount *= 100;
  const { customerId, status, amount } = validatedFields.data;

  try {
    if (id) {
      await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amount}, status = ${status}
      WHERE id = ${id}`;
    } else {
      const date = new Date().toISOString().split('T')[0];
      await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amount}, ${status}, ${date})`;
    }
  } catch (error) {
    console.log(error);
    return {
      message: 'Database Error: ' + msgError,
    };
  }

  revalidatePath('/dashboard/invoices');
  redirect('/dashboard/invoices');
}

export async function deleteInvoice(id: string) {
  try {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
    return { message: 'Invoice deleted successfully' };
  } catch (error) {
    return {
      message: 'Database Error: Failed to delete invoice',
    };
  }
}
