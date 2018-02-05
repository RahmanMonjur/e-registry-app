/* global eRegistry, angular */
var eRegistry = angular.module('eRegistry');
eRegistry.controller('ProgramSummaryController',
        function($scope,
                DateUtils,
                EventUtils,
                TEIGridService,
                AttributesFactory,
                ProgramFactory,
                ProgramStageFactory,
                CurrentSelection,
                MetaDataFactory,
                EventReportService) {    
    $scope.today = DateUtils.getToday();
    
    $scope.ouModes = [{displayName: 'SELECTED'}, {displayName: 'CHILDREN'}, {displayName: 'DESCENDANTS'}, {displayName: 'ACCESSIBLE'}];         
    $scope.selectedOuMode = $scope.ouModes[0];
    $scope.report = {};
    
    $scope.optionSets = CurrentSelection.getOptionSets();
    if(!$scope.optionSets){
        $scope.optionSets = [];
        MetaDataFactory.getAll('optionSets').then(function(optionSets){
            angular.forEach(optionSets, function(optionSet){  
                $scope.optionSets[optionSet.id] = optionSet;
            });
            CurrentSelection.setOptionSets($scope.optionSets);
        });
    }
    
    //watch for selection of org unit from tree
    $scope.$watch('selectedOrgUnit', function() {      
        $scope.selectedProgram = null;
        $scope.reportStarted = false;
        $scope.dataReady = false;  
        $scope.programStages = null;
        $scope.stagesById = [];
        if( angular.isObject($scope.selectedOrgUnit)){            
            $scope.loadPrograms($scope.selectedOrgUnit);
        }
    });
    
    //load programs associated with the selected org unit.
    $scope.loadPrograms = function(orgUnit) {        
        $scope.selectedOrgUnit = orgUnit;        
        if (angular.isObject($scope.selectedOrgUnit)){
            ProgramFactory.getProgramsByOu($scope.selectedOrgUnit,true, $scope.selectedProgram).then(function(response){
                $scope.programs = response.programs;
                $scope.selectedProgram = response.selectedProgram;
            });
        }        
    };
    
    $scope.$watch('selectedProgram', function() {        
        $scope.programStages = null;
        $scope.stagesById = [];
        if( angular.isObject($scope.selectedProgram)){            
            $scope.reportStarted = false;
            $scope.dataReady = false;        
            $scope.programStages = $scope.selectedProgram.programStages;
            $scope.stagesById = [];
            angular.forEach(stages, function(stage){
                $scope.stagesById[stage.id] = stage;
            });
        }
    });
    
    $scope.generateReport = function(program, report, ouMode){
        
        $scope.selectedProgram = program;
        $scope.report = report;
        $scope.selectedOuMode = ouMode;
        
        //check for form validity
        $scope.outerForm.submitted = true;        
        if( $scope.outerForm.$invalid || !$scope.selectedProgram){
            return false;
        }
        
        $scope.reportStarted = true;
        $scope.dataReady = false;
            
        AttributesFactory.getByProgram($scope.selectedProgram).then(function(atts){            
            var grid = TEIGridService.generateGridColumns(atts, $scope.selectedOuMode.displayName,true);   
            $scope.gridColumns = grid.columns;
        });  
        
        EventReportService.getEventReport($scope.selectedOrgUnit.id, 
                                        $scope.selectedOuMode.displayName, 
                                        $scope.selectedProgram.id, 
                                        DateUtils.formatFromUserToApi($scope.report.startDate), 
                                        DateUtils.formatFromUserToApi($scope.report.endDate), 
                                        null,
                                        null, 
                                        $scope.pager).then(function(data){
            $scope.dhis2Events = [];  
            $scope.teiList = [];
            
            if( data && data.eventRows ){
                angular.forEach(data.eventRows, function(ev){
                    if(ev.trackedEntityInstance){
                        ev.displayName = $scope.stagesById[ev.programStage].displayName;
                        ev.programName = $scope.selectedProgram.displayName;
                        ev.statusColor = EventUtils.getEventStatusColor(ev); 
                        ev.eventDate = DateUtils.formatFromApiToUser(ev.eventDate);

                        angular.forEach(ev.dataValues, function(dv){
                            ev[dv.dataElement] = dv.value;
                            $scope.stagesById[ev.programStage].hasData = true;
                        });

                        angular.forEach(ev.attributes, function(att){
                            ev[att.attribute] = att.value;
                        });

                        if($scope.teiList.indexOf(ev.trackedEntityInstance) === -1){
                            $scope.teiList.push( ev.trackedEntityInstance );
                        }
                        $scope.dhis2Events.push(ev);
                    }
                });
            }
            
            $scope.reportStarted = false;
            $scope.dataReady = true;            
        });
    };    
});