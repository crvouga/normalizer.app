import type { ReactNode } from 'react';
import { usePolicyCheck } from '~/src/permissions/use-policy-check';
import type { Permission } from './permission';
import type { Policy, PolicyContext } from './policy';
import { PermissionGuard } from './permission-guard';

export const PolicyCheckGuard = (props: {
  permission: Permission;
  policy: Policy;
  extraContext?: Partial<PolicyContext>;
  onRedirect: () => void;
  children: ReactNode;
}) => {
  const result = usePolicyCheck(props.permission, props.policy, props.extraContext);

  return (
    <PermissionGuard
      hasPermission={result.granted}
      isLoading={result.isLoading}
      error={result.reason ? new Error(result.reason) : null}
      onRedirect={props.onRedirect}
    >
      {props.children}
    </PermissionGuard>
  );
};
