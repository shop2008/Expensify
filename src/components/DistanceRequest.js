import React, {useEffect, useMemo, useRef} from 'react';
import {View} from 'react-native';
import {withOnyx} from 'react-native-onyx';
import lodashGet from 'lodash/get';
import lodashIsNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import _ from 'underscore';

import CONST from '../CONST';
import ROUTES from '../ROUTES';
import ONYXKEYS from '../ONYXKEYS';

import styles from '../styles/styles';
import variables from '../styles/variables';
import theme from '../styles/themes/default';

import transactionPropTypes from './transactionPropTypes';

import useNetwork from '../hooks/useNetwork';
import usePrevious from '../hooks/usePrevious';
import useLocalize from '../hooks/useLocalize';

import * as ErrorUtils from '../libs/ErrorUtils';
import Navigation from '../libs/Navigation/Navigation';
import * as MapboxToken from '../libs/actions/MapboxToken';
import * as Transaction from '../libs/actions/Transaction';
import * as TransactionUtils from '../libs/TransactionUtils';
import * as IOUUtils from '../libs/IOUUtils';

import Button from './Button';
import DistanceMapView from './DistanceMapView';
import DraggableList from './DraggableList';
import * as Expensicons from './Icon/Expensicons';
import PendingMapView from './MapView/PendingMapView';
import DotIndicatorMessage from './DotIndicatorMessage';
import MenuItemWithTopDescription from './MenuItemWithTopDescription';
import {iouPropTypes} from '../pages/iou/propTypes';
import reportPropTypes from '../pages/reportPropTypes';
import * as IOU from '../libs/actions/IOU';
import ScreenWrapper from './ScreenWrapper';
import FullPageNotFoundView from './BlockingViews/FullPageNotFoundView';
import HeaderWithBackButton from './HeaderWithBackButton';

const MAX_WAYPOINTS = 25;

const propTypes = {
    /** Holds data related to Money Request view state, rather than the underlying Money Request data. */
    iou: iouPropTypes,

    /** Type of money request (i.e. IOU) */
    iouType: PropTypes.oneOf(_.values(CONST.IOU.MONEY_REQUEST_TYPE)),

    /** The report to which the distance request is associated */
    report: reportPropTypes,

    /** The optimistic transaction for this request */
    transaction: transactionPropTypes,

    /** Data about Mapbox token for calling Mapbox API */
    mapboxAccessToken: PropTypes.shape({
        /** Temporary token for Mapbox API */
        token: PropTypes.string,

        /** Time when the token will expire in ISO 8601 */
        expiration: PropTypes.string,
    }),

    /** React Navigation route */
    route: PropTypes.shape({
        /** Params from the route */
        params: PropTypes.shape({
            /** The type of IOU report, i.e. bill, request, send */
            iouType: PropTypes.string,

            /** The report ID of the IOU */
            reportID: PropTypes.string,
        }),
    }).isRequired,
};

const defaultProps = {
    iou: {},
    iouType: '',
    report: {},
    transaction: {},
    mapboxAccessToken: {
        token: '',
    },
};

function DistanceRequest({iou, iouType, report, transaction, mapboxAccessToken, route}) {
    const {isOffline} = useNetwork();
    const {translate} = useLocalize();

    const isEditing = lodashGet(route, 'path', '').includes('address');
    const reportID = lodashGet(report, 'reportID', '');
    const waypoints = useMemo(() => lodashGet(transaction, 'comment.waypoints', {}), [transaction]);
    const waypointsList = _.keys(waypoints);
    const previousWaypoints = usePrevious(waypoints);
    const numberOfWaypoints = _.size(waypoints);
    const numberOfPreviousWaypoints = _.size(previousWaypoints);
    const scrollViewRef = useRef(null);

    const lastWaypointIndex = numberOfWaypoints - 1;
    const isLoadingRoute = lodashGet(transaction, 'comment.isLoading', false);
    const hasRouteError = !!lodashGet(transaction, 'errorFields.route');
    const hasRoute = TransactionUtils.hasRoute(transaction);
    const validatedWaypoints = TransactionUtils.getValidWaypoints(waypoints);
    const previousValidatedWaypoints = usePrevious(validatedWaypoints);
    const haveValidatedWaypointsChanged = !_.isEqual(previousValidatedWaypoints, validatedWaypoints);
    const isRouteAbsentWithoutErrors = !hasRoute && !hasRouteError;
    const shouldFetchRoute = (isRouteAbsentWithoutErrors || haveValidatedWaypointsChanged) && !isLoadingRoute && _.size(validatedWaypoints) > 1;
    const waypointMarkers = useMemo(
        () =>
            _.filter(
                _.map(waypoints, (waypoint, key) => {
                    if (!waypoint || lodashIsNil(waypoint.lat) || lodashIsNil(waypoint.lng)) {
                        return;
                    }

                    const index = TransactionUtils.getWaypointIndex(key);
                    let MarkerComponent;
                    if (index === 0) {
                        MarkerComponent = Expensicons.DotIndicatorUnfilled;
                    } else if (index === lastWaypointIndex) {
                        MarkerComponent = Expensicons.Location;
                    } else {
                        MarkerComponent = Expensicons.DotIndicator;
                    }

                    return {
                        id: `${waypoint.lng},${waypoint.lat},${index}`,
                        coordinate: [waypoint.lng, waypoint.lat],
                        markerComponent: () => (
                            <MarkerComponent
                                width={CONST.MAP_MARKER_SIZE}
                                height={CONST.MAP_MARKER_SIZE}
                                fill={theme.icon}
                            />
                        ),
                    };
                }),
                (waypoint) => waypoint,
            ),
        [waypoints, lastWaypointIndex],
    );

    useEffect(() => {
        MapboxToken.init();
        return MapboxToken.stop;
    }, []);

    useEffect(() => {
        if (!iou.transactionID || !_.isEmpty(waypoints)) {
            return;
        }
        // Create the initial start and stop waypoints
        Transaction.createInitialWaypoints(iou.transactionID);
    }, [iou.transactionID, waypoints]);

    useEffect(() => {
        if (isOffline || !shouldFetchRoute) {
            return;
        }

        Transaction.getRoute(iou.transactionID, validatedWaypoints);
    }, [shouldFetchRoute, iou.transactionID, validatedWaypoints, isOffline]);

    useEffect(() => {
        if (numberOfWaypoints <= numberOfPreviousWaypoints) {
            return;
        }
        scrollViewRef.current.scrollToEnd({animated: true});
    }, [numberOfPreviousWaypoints, numberOfWaypoints]);

    const navigateBack = () => {
        Navigation.goBack(isEditing ? ROUTES.getMoneyRequestConfirmationRoute(iouType, reportID) : ROUTES.HOME);
    };

    const navigateToNextPage = () => {
        if (isEditing) {
            Navigation.goBack(ROUTES.getMoneyRequestConfirmationRoute(iouType, reportID));
            return;
        }

        IOU.navigateToNextPage(iou, iouType, reportID, report);
    };

    const footer = (
        <>
            {hasRouteError && (
                <DotIndicatorMessage
                    style={[styles.mh5, styles.mv3]}
                    messages={ErrorUtils.getLatestErrorField(transaction, 'route')}
                    type="error"
                />
            )}
            <View style={[styles.flexRow, styles.justifyContentCenter, styles.pt1]}>
                <Button
                    small
                    icon={Expensicons.Plus}
                    onPress={() => {
                        const newIndex = _.size(lodashGet(transaction, 'comment.waypoints', {}));
                        Navigation.navigate(ROUTES.getMoneyRequestWaypointRoute('request', newIndex));
                    }}
                    text={translate('distance.addStop')}
                    isDisabled={numberOfWaypoints === MAX_WAYPOINTS}
                    innerStyles={[styles.ph10]}
                />
            </View>
            <View style={styles.mapViewContainer}>
                {!isOffline && Boolean(mapboxAccessToken.token) ? (
                    <DistanceMapView
                        accessToken={mapboxAccessToken.token}
                        mapPadding={CONST.MAPBOX.PADDING}
                        pitchEnabled={false}
                        initialState={{
                            zoom: CONST.MAPBOX.DEFAULT_ZOOM,
                            location: CONST.MAPBOX.DEFAULT_COORDINATE,
                        }}
                        directionCoordinates={lodashGet(transaction, 'routes.route0.geometry.coordinates', [])}
                        style={styles.mapView}
                        waypoints={waypointMarkers}
                        styleURL={CONST.MAPBOX.STYLE_URL}
                        overlayStyle={styles.m4}
                    />
                ) : (
                    <PendingMapView
                        title={translate('distance.mapPending.title')}
                        subtitle={isOffline ? translate('distance.mapPending.subtitle') : translate('distance.mapPending.onlineSubtitle')}
                    />
                )}
            </View>
        </>
    );

    const content = (
        <>
            <View style={styles.flex1}>
                <DraggableList
                    data={waypointsList}
                    keyExtractor={(item) => item}
                    shouldUsePortal
                    onDragEnd={({data}) => {
                        const newWaypoints = {};
                        _.each(data, (waypoint, index) => {
                            newWaypoints[`waypoint${index}`] = lodashGet(waypoints, waypoint, null);
                        });
                        Transaction.updateWaypoints(iou.transactionID, newWaypoints);
                    }}
                    scrollEventThrottle={variables.distanceScrollEventThrottle}
                    ref={scrollViewRef}
                    renderItem={({item, drag, getIndex, isActive}) => {
                        const index = getIndex();
                        let descriptionKey = 'distance.waypointDescription.';
                        let waypointIcon;
                        if (index === 0) {
                            descriptionKey += 'start';
                            waypointIcon = Expensicons.DotIndicatorUnfilled;
                        } else if (index === lastWaypointIndex) {
                            descriptionKey += 'finish';
                            waypointIcon = Expensicons.Location;
                        } else {
                            descriptionKey += 'stop';
                            waypointIcon = Expensicons.DotIndicator;
                        }

                        return (
                            <MenuItemWithTopDescription
                                description={translate(descriptionKey)}
                                title={lodashGet(waypoints, [`waypoint${index}`, 'address'], '')}
                                icon={Expensicons.DragHandles}
                                iconFill={theme.icon}
                                secondaryIcon={waypointIcon}
                                secondaryIconFill={theme.icon}
                                shouldShowRightIcon
                                onPress={() => Navigation.navigate(ROUTES.getMoneyRequestWaypointRoute('request', index))}
                                onSecondaryInteraction={drag}
                                focused={isActive}
                                key={item}
                            />
                        );
                    }}
                    ListFooterComponent={footer}
                />
            </View>
            <View style={[styles.w100, styles.pt2]}>
                <Button
                    success
                    style={[styles.w100, styles.mb4, styles.ph4, styles.flexShrink0]}
                    onPress={navigateToNextPage}
                    isDisabled={_.size(validatedWaypoints) < 2 || hasRouteError}
                    text={translate('common.next')}
                />
            </View>
        </>
    );

    if (!isEditing) {
        return content;
    }

    return (
        <ScreenWrapper
            includeSafeAreaPaddingBottom={false}
            shouldEnableKeyboardAvoidingView={false}
        >
            {({safeAreaPaddingBottomStyle}) => (
                <FullPageNotFoundView shouldShow={!IOUUtils.isValidMoneyRequestType(iouType)}>
                    <View style={[styles.flex1, safeAreaPaddingBottomStyle]}>
                        <HeaderWithBackButton
                            title={translate('common.distance')}
                            onBackButonBackButtonPress={navigateBack}
                        />
                        {content}
                    </View>
                </FullPageNotFoundView>
            )}
        </ScreenWrapper>
    );
}

DistanceRequest.displayName = 'DistanceRequest';
DistanceRequest.propTypes = propTypes;
DistanceRequest.defaultProps = defaultProps;
export default withOnyx({
    transaction: {
        key: (props) => `${ONYXKEYS.COLLECTION.TRANSACTION}${props.iou.transactionID}`,
    },
    mapboxAccessToken: {
        key: ONYXKEYS.MAPBOX_ACCESS_TOKEN,
    },
})(DistanceRequest);
