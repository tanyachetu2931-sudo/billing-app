pipeline {
  agent any
  options { timestamps(); disableConcurrentBuilds() }
  environment {
    AWS_DEFAULT_REGION = 'ap-south-1'
    ECR_REPOSITORY = 'billing-app'
    K8S_NAMESPACE = 'billing'
  }
  stages {
    stage('Checkout') { steps { checkout scm } }
    stage('Validate') {
      steps {
        sh 'node --version'
        sh 'docker --version'
        sh 'docker compose config -q'
        sh 'node --check backend/src/server.js'
      }
    }
    stage('Build images') {
      steps {
        sh 'docker build -t billing-backend:${BUILD_NUMBER} ./backend'
        sh 'docker build -t billing-frontend:${BUILD_NUMBER} ./frontend'
      }
    }
    // Configure AWS credentials in Jenkins Credentials and install AWS CLI first.
    // Create ECR repositories and an EKS cluster before enabling these deployment stages.
    stage('Publish to ECR') {
      when { expression { return env.PUBLISH_TO_ECR == 'true' } }
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-jenkins-credentials']]) {
          sh '''
            ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
            REGISTRY=${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com
            aws ecr get-login-password --region ${AWS_DEFAULT_REGION} | docker login --username AWS --password-stdin ${REGISTRY}
            for APP in backend frontend; do
              docker tag billing-${APP}:${BUILD_NUMBER} ${REGISTRY}/${ECR_REPOSITORY}-${APP}:${BUILD_NUMBER}
              docker push ${REGISTRY}/${ECR_REPOSITORY}-${APP}:${BUILD_NUMBER}
            done
          '''
        }
      }
    }
    stage('Deploy to EKS') {
      when { expression { return env.DEPLOY_TO_EKS == 'true' } }
      steps {
        withCredentials([[$class: 'AmazonWebServicesCredentialsBinding', credentialsId: 'aws-jenkins-credentials']]) {
          sh '''
            ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
            REGISTRY=${ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com
            aws eks update-kubeconfig --region ${AWS_DEFAULT_REGION} --name ${EKS_CLUSTER_NAME}
            kubectl create namespace ${K8S_NAMESPACE} --dry-run=client -o yaml | kubectl apply -f -
            kubectl -n ${K8S_NAMESPACE} set image deployment/billing-backend backend=${REGISTRY}/${ECR_REPOSITORY}-backend:${BUILD_NUMBER} --record=false
            kubectl -n ${K8S_NAMESPACE} set image deployment/billing-frontend frontend=${REGISTRY}/${ECR_REPOSITORY}-frontend:${BUILD_NUMBER} --record=false
            kubectl -n ${K8S_NAMESPACE} rollout status deployment/billing-backend --timeout=180s
            kubectl -n ${K8S_NAMESPACE} rollout status deployment/billing-frontend --timeout=180s
          '''
        }
      }
    }
  }
  post { always { sh 'docker image prune -f || true' } }
}
