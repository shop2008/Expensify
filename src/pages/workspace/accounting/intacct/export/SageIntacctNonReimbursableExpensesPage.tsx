import React, {useCallback, useMemo} from 'react';
import {View} from 'react-native';
import type {ValueOf} from 'type-fest';
import HeaderWithBackButton from '@components/HeaderWithBackButton';
import MenuItemWithTopDescription from '@components/MenuItemWithTopDescription';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import ScreenWrapper from '@components/ScreenWrapper';
import SelectionList from '@components/SelectionList';
import RadioListItem from '@components/SelectionList/RadioListItem';
import type {ListItem} from '@components/SelectionList/types';
import type {SelectorType} from '@components/SelectionScreen';
import Text from '@components/Text';
import useLocalize from '@hooks/useLocalize';
import useThemeStyles from '@hooks/useThemeStyles';
import {getSageIntacctNonReimbursableActiveDefaultVendor} from '@libs/PolicyUtils';
import Navigation from '@navigation/Navigation';
import type {WithPolicyProps} from '@pages/workspace/withPolicy';
import withPolicyConnections from '@pages/workspace/withPolicyConnections';
import ToggleSettingOptionRow from '@pages/workspace/workflows/ToggleSettingsOptionRow';
import {updateSageIntacctDefaultVendor, updateSageIntacctNonreimbursableExpensesExportDestination} from '@userActions/connections/SageIntacct';
import CONST from '@src/CONST';
import ROUTES from '@src/ROUTES';
import type {SageIntacctDataElementWithValue} from '@src/types/onyx/Policy';

type MenuListItem = ListItem & {
    value: ValueOf<typeof CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE>;
};

function getDefaultVendorName(defaultVendor: string, vendors: SageIntacctDataElementWithValue[]): string {
    return vendors.find((vendor) => vendor.id === defaultVendor)?.value ?? defaultVendor;
}

function SageIntacctNonReimbursableExpensesPage({policy}: WithPolicyProps) {
    const {translate} = useLocalize();
    const policyID = policy?.id ?? '-1';
    const styles = useThemeStyles();
    const {data: intacctData, config} = policy?.connections?.intacct ?? {};

    const data: MenuListItem[] = Object.values(CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE).map((expenseType) => ({
        value: expenseType,
        text: translate(`workspace.sageIntacct.nonReimbursableExpenses.values.${expenseType}`),
        keyForList: expenseType,
        isSelected: config?.export.nonReimbursable === expenseType,
    }));

    const headerContent = useMemo(
        () => (
            <View>
                <Text style={[styles.ph5, styles.pb5]}>{translate('workspace.sageIntacct.nonReimbursableExpenses.description')}</Text>
            </View>
        ),
        [translate, styles.pb5, styles.ph5],
    );

    const selectNonReimbursableExpense = useCallback(
        (row: MenuListItem) => {
            if (row.value === config?.export.nonReimbursable) {
                return;
            }
            updateSageIntacctNonreimbursableExpensesExportDestination(policyID, row.value);
        },
        [config?.export.nonReimbursable, policyID],
    );

    const activeDefaultVendor = getSageIntacctNonReimbursableActiveDefaultVendor(policy);
    const defaultVendorSection = {
        description: translate('workspace.sageIntacct.defaultVendor'),
        action: () => Navigation.navigate(ROUTES.POLICY_ACCOUNTING_SAGE_INTACCT_DEFAULT_VENDOR.getRoute(policyID, CONST.SAGE_INTACCT_CONFIG.NON_REIMBURSABLE.toLowerCase())),
        title: activeDefaultVendor ? getDefaultVendorName(activeDefaultVendor, intacctData?.vendors ?? []) : translate('workspace.sageIntacct.notConfigured'),
        hasError:
            config?.export.nonReimbursable === CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE.VENDOR_BILL
                ? !!config?.export?.errorFields?.nonReimbursableVendor
                : !!config?.export?.errorFields?.nonReimbursableCreditCardChargeDefaultVendor,
        pendingAction:
            config?.export.nonReimbursable === CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE.VENDOR_BILL
                ? config?.export?.pendingFields?.nonReimbursableVendor
                : config?.export?.pendingFields?.nonReimbursableCreditCardChargeDefaultVendor,
    };

    const defaultVendor = (
        <OfflineWithFeedback
            key={defaultVendorSection.description}
            pendingAction={defaultVendorSection.pendingAction}
        >
            <MenuItemWithTopDescription
                title={defaultVendorSection.title}
                description={defaultVendorSection.description}
                shouldShowRightIcon
                onPress={defaultVendorSection.action}
                brickRoadIndicator={defaultVendorSection.hasError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
            />
        </OfflineWithFeedback>
    );

    const creditCardAccountSection = {
        description: translate('workspace.sageIntacct.creditCardAccount'),
        action: () => Navigation.navigate(ROUTES.POLICY_ACCOUNTING_SAGE_INTACCT_NON_REIMBURSABLE_CREDIT_CARD_ACCOUNT.getRoute(policyID)),
        title: config?.export.nonReimbursableAccount ? config.export.nonReimbursableAccount : translate('workspace.sageIntacct.notConfigured'),
        hasError: !!config?.export?.errorFields?.nonReimbursableAccount,
        pendingAction: config?.export?.pendingFields?.nonReimbursableAccount,
    };

    const creditCardAccount = (
        <OfflineWithFeedback
            key={creditCardAccountSection.description}
            pendingAction={creditCardAccountSection.pendingAction}
        >
            <MenuItemWithTopDescription
                title={creditCardAccountSection.title}
                description={creditCardAccountSection.description}
                shouldShowRightIcon
                onPress={creditCardAccountSection.action}
                brickRoadIndicator={creditCardAccountSection.hasError ? CONST.BRICK_ROAD_INDICATOR_STATUS.ERROR : undefined}
            />
        </OfflineWithFeedback>
    );

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            testID={SageIntacctNonReimbursableExpensesPage.displayName}
        >
            <HeaderWithBackButton
                title={translate('workspace.sageIntacct.nonReimbursableExpenses.label')}
                onBackButtonPress={() => Navigation.goBack(ROUTES.POLICY_ACCOUNTING_SAGE_INTACCT_EXPORT.getRoute(policyID))}
            />
            <SelectionList
                onSelectRow={(selection: SelectorType) => selectNonReimbursableExpense(selection as MenuListItem)}
                headerContent={headerContent}
                sections={[{data}]}
                ListItem={RadioListItem}
                showScrollIndicator
                shouldShowTooltips={false}
                listFooterContent={
                    <View>
                        {config?.export.nonReimbursable === CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE.VENDOR_BILL && defaultVendor}
                        {config?.export.nonReimbursable === CONST.SAGE_INTACCT_NON_REIMBURSABLE_EXPENSE_TYPE.CREDIT_CARD_CHARGE && (
                            <View>
                                {creditCardAccount}
                                <ToggleSettingOptionRow
                                    title={translate('workspace.sageIntacct.defaultVendor')}
                                    subtitle={translate('workspace.sageIntacct.defaultVendorDescription', false)}
                                    shouldPlaceSubtitleBelowSwitch
                                    switchAccessibilityLabel={translate('workspace.sageIntacct.defaultVendor')}
                                    isActive={!!config?.export.nonReimbursableCreditCardChargeDefaultVendor}
                                    onToggle={(enabled) => {
                                        const vendor = enabled ? policy?.connections?.intacct?.data?.vendors?.[0].id ?? null : null;
                                        updateSageIntacctDefaultVendor(policyID, CONST.SAGE_INTACCT_CONFIG.NON_REIMBURSABLE_CREDIT_CARD_VENDOR, vendor);
                                    }}
                                    wrapperStyle={[styles.ph5, styles.pv3]}
                                    pendingAction={config?.export?.pendingFields?.nonReimbursableCreditCardChargeDefaultVendor}
                                />
                                {!!config?.export.nonReimbursableCreditCardChargeDefaultVendor && defaultVendor}
                            </View>
                        )}
                    </View>
                }
            />
        </ScreenWrapper>
    );
}

SageIntacctNonReimbursableExpensesPage.displayName = 'PolicySageIntacctNonReimbursableExpensesPage';

export default withPolicyConnections(SageIntacctNonReimbursableExpensesPage);
