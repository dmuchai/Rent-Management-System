export async function enqueuePaymentOutbox(tx: any, paymentId: string) {
  const [details] = await tx`
    SELECT pay.id, pay.amount, pay.provider_receipt_id, t.email AS tenant_email,
      t.phone AS tenant_phone, t.first_name AS tenant_name,
      owner.email AS landlord_email, owner.phone_number AS landlord_phone,
      owner.first_name AS landlord_name, prop.name AS property_name, u.unit_number
    FROM public.payments pay
    JOIN public.leases l ON l.id = pay.lease_id
    JOIN public.tenants t ON t.id = l.tenant_id
    JOIN public.units u ON u.id = l.unit_id
    JOIN public.properties prop ON prop.id = u.property_id
    JOIN public.users owner ON owner.id = prop.owner_id
    WHERE pay.id = ${paymentId}
  `;
  if (!details) return;
  const receipt = details.provider_receipt_id ? ` Receipt ${details.provider_receipt_id}.` : '';
  const tenantText = `Payment of KES ${details.amount} received for ${details.property_name}, unit ${details.unit_number}.${receipt}`;
  const landlordText = `Payment of KES ${details.amount} received from ${details.tenant_name} for ${details.property_name}, unit ${details.unit_number}.${receipt}`;

  if (details.tenant_email) await tx`
    INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata, idempotency_key)
    VALUES (${details.tenant_email}, 'Rent payment received', ${`<p>${tenantText}</p>`}, ${tenantText},
      ${JSON.stringify({ type: 'payment_confirmation', paymentId, recipient: 'tenant' })}::jsonb,
      ${`payment:${paymentId}:email:tenant`})
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`;
  if (details.landlord_email) await tx`
    INSERT INTO public.email_queue ("to", subject, html_content, text_content, metadata, idempotency_key)
    VALUES (${details.landlord_email}, 'Rent payment received', ${`<p>${landlordText}</p>`}, ${landlordText},
      ${JSON.stringify({ type: 'payment_confirmation', paymentId, recipient: 'landlord' })}::jsonb,
      ${`payment:${paymentId}:email:landlord`})
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`;
  if (details.tenant_phone) await tx`
    INSERT INTO public.sms_queue ("to", message, metadata, idempotency_key)
    VALUES (${details.tenant_phone}, ${tenantText},
      ${JSON.stringify({ type: 'payment_confirmation', paymentId, recipient: 'tenant' })}::jsonb,
      ${`payment:${paymentId}:sms:tenant`})
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`;
  if (details.landlord_phone) await tx`
    INSERT INTO public.sms_queue ("to", message, metadata, idempotency_key)
    VALUES (${details.landlord_phone}, ${landlordText},
      ${JSON.stringify({ type: 'payment_confirmation', paymentId, recipient: 'landlord' })}::jsonb,
      ${`payment:${paymentId}:sms:landlord`})
    ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`;
}
