import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createDbConnection } from '../_lib/db.js';
import { requireAuth, supabaseAdmin } from '../_lib/auth.js';
import { z } from 'zod';
import crypto from 'crypto';
import { emailService } from '../_lib/emailService.js';

const DEFAULT_EXPIRY_DAYS = 7;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action as string | undefined;
  const tokenParam = req.query.token as string | undefined;

  if (req.method === 'GET' && !tokenParam) {
    return requireAuth(async (req, res, auth) => {
      const sql = createDbConnection();

      try {
        if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
          return res.status(403).json({ error: 'Only landlords can view caretaker invitations' });
        }

        const invitations = await sql`
          SELECT
            id,
            email,
            first_name as "firstName",
            last_name as "lastName",
            status,
            invitation_sent_at as "invitationSentAt",
            invitation_accepted_at as "invitationAcceptedAt",
            expires_at as "expiresAt",
            property_id as "propertyId",
            unit_id as "unitId",
            created_at as "createdAt"
          FROM public.caretaker_invitations
          WHERE landlord_id = ${auth.userId}
          ORDER BY created_at DESC
        `;

        return res.status(200).json(invitations);
      } catch (error) {
        console.error('Error listing caretaker invitations:', error);
        return res.status(500).json({ error: 'Failed to fetch caretaker invitations' });
      } finally {
        await sql.end();
      }
    })(req, res);
  }

  if (req.method === 'GET' || (req.method === 'POST' && action === 'verify')) {
    const sql = createDbConnection();

    try {
      const querySchema = z.object({
        token: z.string().min(1, 'Token is required'),
      });

      const { token } = querySchema.parse(req.query);

      const invitations = await sql`
        SELECT id, first_name, last_name, email, invitation_sent_at, status, expires_at
        FROM public.caretaker_invitations
        WHERE invitation_token = ${token}
        AND status IN ('invited', 'pending')
      `;

      if (invitations.length === 0) {
        return res.status(404).json({
          error: 'Invalid or expired invitation token',
          message: 'This invitation link is invalid or has already been used.'
        });
      }

      const invitation = invitations[0];

      if (!invitation.invitation_sent_at) {
        return res.status(400).json({
          error: 'Invitation not sent',
          message: 'This invitation has not been sent yet.'
        });
      }

      const expiresAt = invitation.expires_at
        ? new Date(invitation.expires_at)
        : new Date(new Date(invitation.invitation_sent_at).getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return res.status(410).json({
          error: 'Invitation expired',
          message: 'This invitation link has expired. Please request a new invitation from your landlord.',
          expired: true
        });
      }

      return res.status(200).json({
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        email: invitation.email,
        valid: true
      });
    } catch (error) {
      console.error('Error verifying caretaker invitation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Token parameter is required'
        });
      }
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to verify invitation'
      });
    } finally {
      await sql.end();
    }
  }

  if (req.method === 'POST' && action === 'accept') {
    const sql = createDbConnection();

    try {
      const acceptSchema = z.object({
        token: z.string().min(1, 'Token is required'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
      });

      const { token, password } = acceptSchema.parse(req.body);

      const invitations = await sql`
        SELECT id, landlord_id, email, first_name, last_name, invitation_sent_at, status, expires_at, property_id, unit_id
        FROM public.caretaker_invitations
        WHERE invitation_token = ${token}
        AND status IN ('invited', 'pending')
      `;

      if (invitations.length === 0) {
        return res.status(404).json({
          error: 'Invalid invitation',
          message: 'This invitation link is invalid or has already been used.'
        });
      }

      const invitation = invitations[0];

      if (!invitation.invitation_sent_at) {
        return res.status(410).json({
          error: 'Invalid invitation',
          message: 'This invitation is invalid. Please request a new invitation from your landlord.'
        });
      }

      const expiresAt = invitation.expires_at
        ? new Date(invitation.expires_at)
        : new Date(new Date(invitation.invitation_sent_at).getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return res.status(410).json({
          error: 'Invitation expired',
          message: 'This invitation link has expired. Please request a new invitation from your landlord.'
        });
      }

      const [existingUserRecord] = await sql`
        SELECT id, role FROM public.users WHERE email = ${invitation.email}
      `;

      if (existingUserRecord && existingUserRecord.role && existingUserRecord.role !== 'caretaker') {
        return res.status(400).json({
          error: 'Account already exists',
          message: `This email is already registered as a ${existingUserRecord.role}.`
        });
      }

      const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
      const existingAuthUser = existingUsers?.users?.find(user => user.email === invitation.email);

      let authUserId: string;

      if (existingAuthUser) {
        const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
          existingAuthUser.id,
          { password, user_metadata: { role: 'caretaker', first_name: invitation.first_name, last_name: invitation.last_name } }
        );

        if (updateError) {
          return res.status(500).json({
            error: 'Account update failed',
            message: 'Failed to update account. Please contact support.'
          });
        }

        authUserId = existingAuthUser.id;
      } else {
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: invitation.email,
          password,
          email_confirm: true,
          user_metadata: {
            first_name: invitation.first_name,
            last_name: invitation.last_name,
            role: 'caretaker',
          }
        });

        if (authError || !authData.user) {
          return res.status(500).json({
            error: 'Account creation failed',
            message: authError?.message || 'Failed to create user account'
          });
        }

        authUserId = authData.user.id;
      }

      try {
        await sql.begin(async (tx: any) => {
          await tx`
            INSERT INTO public.users (id, email, first_name, last_name, role, created_by, status)
            VALUES (
              ${authUserId},
              ${invitation.email},
              ${invitation.first_name},
              ${invitation.last_name},
              'caretaker',
              ${invitation.landlord_id},
              'active'
            )
            ON CONFLICT (id) DO UPDATE SET
              role = EXCLUDED.role,
              created_by = EXCLUDED.created_by,
              status = EXCLUDED.status
          `;

          if (invitation.property_id || invitation.unit_id) {
            await tx`
              INSERT INTO public.caretaker_assignments (caretaker_id, landlord_id, property_id, unit_id, status)
              VALUES (
                ${authUserId},
                ${invitation.landlord_id},
                ${invitation.property_id || null},
                ${invitation.unit_id || null},
                'active'
              )
            `;
          }

          await tx`
            UPDATE public.caretaker_invitations
            SET
              invitation_accepted_at = NOW(),
              status = 'accepted',
              invitation_token = NULL,
              updated_at = NOW()
            WHERE id = ${invitation.id}
          `;
        });
      } catch (dbError) {
        console.error('Caretaker invitation DB transaction failed:', dbError);
        if (!existingAuthUser) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
          } catch (deleteError) {
            console.error('Failed to delete orphaned caretaker user:', deleteError);
          }
        }

        return res.status(500).json({
          error: 'Account creation failed',
          message: 'Failed to complete account setup. Please try again.'
        });
      }

      return res.status(201).json({
        message: 'Account created successfully',
        requireLogin: true,
        email: invitation.email
      });
    } catch (error) {
      console.error('Error accepting caretaker invitation:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Invalid input',
          errors: error.errors
        });
      }
      return res.status(500).json({
        error: 'Server error',
        message: 'Failed to accept invitation'
      });
    } finally {
      await sql.end();
    }
  }

  if (req.method === 'POST' && action === 'create') {
    return requireAuth(async (req, res, auth) => {
      const sql = createDbConnection();

      try {
        if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
          return res.status(403).json({ error: 'Only landlords can invite caretakers' });
        }

        const inviteSchema = z.object({
          email: z.string().email(),
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          propertyId: z.string().optional().nullable(),
          unitId: z.string().optional().nullable(),
        }).refine((data) => data.propertyId || data.unitId, {
          message: 'Either propertyId or unitId is required',
          path: ['propertyId']
        });

        const inviteData = inviteSchema.parse(req.body);

        if (inviteData.propertyId) {
          const [property] = await sql`
            SELECT id FROM public.properties WHERE id = ${inviteData.propertyId} AND owner_id = ${auth.userId}
          `;
          if (!property) {
            return res.status(403).json({ error: 'Property not found for this landlord' });
          }
        }

        if (inviteData.unitId) {
          const [unit] = await sql`
            SELECT u.id FROM public.units u
            JOIN public.properties p ON p.id = u.property_id
            WHERE u.id = ${inviteData.unitId} AND p.owner_id = ${auth.userId}
          `;
          if (!unit) {
            return res.status(403).json({ error: 'Unit not found for this landlord' });
          }
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        const [invitation] = await sql`
          INSERT INTO public.caretaker_invitations (
            landlord_id, invited_by, email, first_name, last_name,
            invitation_token, status, expires_at, property_id, unit_id
          ) VALUES (
            ${auth.userId}, ${auth.userId}, ${inviteData.email}, ${inviteData.firstName}, ${inviteData.lastName},
            ${token}, 'pending', ${expiresAt.toISOString()}, ${inviteData.propertyId || null}, ${inviteData.unitId || null}
          ) RETURNING *
        `;

        const [landlord] = await sql`
          SELECT first_name, last_name FROM public.users WHERE id = ${auth.userId}
        `;

        await emailService.sendCaretakerInvitation(
          invitation.email,
          `${invitation.first_name} ${invitation.last_name}`,
          token,
          landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );

        const [updatedInvitation] = await sql`
          UPDATE public.caretaker_invitations
          SET invitation_sent_at = NOW(), status = 'invited', updated_at = NOW()
          WHERE id = ${invitation.id}
          RETURNING id, email, first_name as "firstName", last_name as "lastName", status,
            invitation_sent_at as "invitationSentAt", expires_at as "expiresAt", property_id as "propertyId", unit_id as "unitId"
        `;

        return res.status(201).json(updatedInvitation);
      } catch (error) {
        console.error('Error creating caretaker invitation:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid input', errors: error.errors });
        }
        return res.status(500).json({ error: 'Failed to create caretaker invitation' });
      } finally {
        await sql.end();
      }
    })(req, res);
  }

  if (req.method === 'POST' && action === 'resend') {
    return requireAuth(async (req, res, auth) => {
      const sql = createDbConnection();

      try {
        if (auth.role !== 'landlord' && auth.role !== 'property_manager') {
          return res.status(403).json({ error: 'Only landlords can resend caretaker invitations' });
        }

        const resendSchema = z.object({
          invitationId: z.string().min(1),
        });

        const { invitationId } = resendSchema.parse(req.body);

        const [invitation] = await sql`
          SELECT * FROM public.caretaker_invitations
          WHERE id = ${invitationId} AND landlord_id = ${auth.userId}
        `;

        if (!invitation) {
          return res.status(404).json({ error: 'Invitation not found' });
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

        await sql`
          UPDATE public.caretaker_invitations
          SET invitation_token = ${token}, invitation_sent_at = NOW(), status = 'invited',
              expires_at = ${expiresAt.toISOString()}, updated_at = NOW()
          WHERE id = ${invitationId}
        `;

        const [landlord] = await sql`
          SELECT first_name, last_name FROM public.users WHERE id = ${auth.userId}
        `;

        await emailService.sendCaretakerInvitation(
          invitation.email,
          `${invitation.first_name} ${invitation.last_name}`,
          token,
          landlord ? `${landlord.first_name} ${landlord.last_name}` : undefined
        );

        return res.status(200).json({
          message: 'Invitation resent successfully',
          email: invitation.email
        });
      } catch (error) {
        console.error('Error resending caretaker invitation:', error);
        if (error instanceof z.ZodError) {
          return res.status(400).json({ error: 'Invalid input', errors: error.errors });
        }
        return res.status(500).json({ error: 'Failed to resend caretaker invitation' });
      } finally {
        await sql.end();
      }
    })(req, res);
  }

  return res.status(400).json({ error: 'Invalid action parameter. Use ?action=verify, ?action=accept, ?action=create, or ?action=resend' });
}
